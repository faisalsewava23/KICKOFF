"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { format } from "date-fns";
import { notifyBookingOutcome } from "@/lib/emails/notify";
import { calculatePlayerTotal } from "@/lib/fees";
import { settleWalletPayout } from "@/lib/payouts";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { planWalletApplication } from "@/lib/wallet";

export type InitiateBookingResult = {
  url?: string;
  // Set when the wallet covered everything: no Stripe, booked on the spot.
  booked?: "confirmed" | "waitlist";
  error?: string;
};

// How long an unfinished part-wallet checkout can pin wallet credit before
// Stripe expires the session and the webhook releases the hold. 30 minutes
// is Stripe's minimum expiry.
const CHECKOUT_EXPIRY_SECONDS = 30 * 60;

// Starts a booking for a game. Everything is re-validated and recomputed
// server-side — the client sends nothing but the game id. Wallet credit is
// applied automatically: full cover books instantly with no Stripe; partial
// cover debits the wallet into a hold and checks out the remainder only.
export async function initiateBooking(
  gameId: string
): Promise<InitiateBookingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { error: "Log in to book a spot." };
  }

  const { data: game } = await supabase
    .from("games")
    .select("*, venue:venues(*)")
    .eq("id", gameId)
    .maybeSingle();
  if (!game || game.status !== "open") {
    return { error: "This game isn't open for bookings." };
  }
  if (new Date(game.kickoff_at).getTime() <= Date.now()) {
    return { error: "This game has already kicked off." };
  }

  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("game_id", gameId)
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing) {
    return { error: "You're already in this game." };
  }

  // Provisional confirmed-vs-waitlist call. The webhook recounts and has the
  // final say — two players can check out for the last spot simultaneously.
  const { data: countRows } = await supabase.rpc("game_booking_counts", {
    game_ids: [gameId],
  });
  const confirmedCount = countRows?.[0]?.confirmed_count ?? 0;
  const intendedStatus =
    confirmedCount < game.max_players ? "confirmed" : "waitlist";

  const price = calculatePlayerTotal(game.price_pence);

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, wallet_balance_pence")
    .eq("id", user.id)
    .maybeSingle();
  const plan = planWalletApplication(price, profile?.wallet_balance_pence ?? 0);

  // ------------------------------------------------------------------
  // Fully covered by wallet: no Stripe at all. The RPC debits and books
  // in one transaction under the same game lock promotions use.
  // ------------------------------------------------------------------
  if (plan.walletPence > 0 && plan.cardPence === 0) {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("book_with_wallet", {
      p_game_id: gameId,
      p_user_id: user.id,
      p_amount: plan.walletPence,
    });
    if (error || !data?.[0]) {
      console.error("[initiateBooking] book_with_wallet failed:", error?.message);
      if (error?.message.includes("insufficient_balance")) {
        // Balance changed under us (e.g. spent in another tab) — reload
        // will re-plan with the real balance.
        return { error: "Your wallet balance changed — try again." };
      }
      if (error?.message.includes("already_booked")) {
        return { error: "You're already in this game." };
      }
      return { error: "Couldn't book with your wallet. Please try again." };
    }
    const outcome = data[0];
    const status = outcome.status === "confirmed" ? "confirmed" : "waitlist";
    if (status === "confirmed") {
      await settleWalletPayout(outcome.booking_id);
    }
    await notifyBookingOutcome(
      gameId,
      user.id,
      status,
      outcome.waitlist_position
    );
    revalidatePath(`/games/${gameId}`);
    revalidatePath("/games");
    revalidatePath("/bookings");
    return { booked: status };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[initiateBooking] STRIPE_SECRET_KEY is not set");
    return {
      error: "Payments aren't switched on yet — hang tight, coming soon.",
    };
  }
  const stripe = getStripe();

  // One Stripe Customer per profile, created lazily and reused — this is
  // what lets Stage 8 charge saved payment methods off-session.
  let customerId: string | null = profile?.stripe_customer_id ?? null;
  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      const { error: saveError } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
      if (saveError) {
        console.error(
          "[initiateBooking] failed to save customer id:",
          saveError.message
        );
      }
    }
  } catch (err) {
    console.error("[initiateBooking] Stripe customer setup failed:", err);
    return { error: "Couldn't start checkout. Please try again." };
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  // ------------------------------------------------------------------
  // Partial wallet cover: debit the wallet into a hold NOW (atomic,
  // balance-checked), then check out the remainder. The webhook consumes
  // the hold on payment or releases it when the session expires.
  // ------------------------------------------------------------------
  const admin = createAdminClient();
  let walletHoldId: string | null = null;
  if (plan.walletPence > 0) {
    const { data: holdId, error: holdError } = await admin.rpc(
      "hold_wallet_for_checkout",
      { p_user_id: user.id, p_game_id: gameId, p_amount: plan.walletPence }
    );
    if (holdError || !holdId) {
      console.error("[initiateBooking] wallet hold failed:", holdError?.message);
      return { error: "Your wallet balance changed — try again." };
    }
    walletHoldId = holdId;
  }
  const releaseHold = async () => {
    if (!walletHoldId) return;
    const { error } = await admin.rpc("release_wallet_hold", {
      p_hold_id: walletHoldId,
    });
    if (error) {
      // The daily janitor releases stranded holds — but say so loudly.
      console.error("[initiateBooking] hold release failed:", error.message);
    }
  };

  const kickoffLabel = format(new Date(game.kickoff_at), "EEE d MMM, HH:mm");
  const metadata = {
    game_id: gameId,
    user_id: user.id,
    intended_status: intendedStatus,
    ...(walletHoldId
      ? {
          wallet_hold_id: walletHoldId,
          wallet_applied_pence: String(plan.walletPence),
        }
      : {}),
  };

  // Connect split: organisers with a connected account get their share
  // routed automatically at payment time. With wallet credit in play the
  // application fee shrinks (see src/lib/wallet.ts) so the organiser's
  // total still lands on exactly their price. The organiser's profile
  // isn't readable by the booker's RLS, so look it up with the service
  // role. Seed games (no connected account) keep the plain platform charge.
  let connectDestination: string | null = null;
  try {
    const { data: organiserProfile } = await admin
      .from("profiles")
      .select("stripe_connect_id")
      .eq("id", game.organiser_id)
      .maybeSingle();
    connectDestination = organiserProfile?.stripe_connect_id ?? null;
  } catch (err) {
    console.error("[initiateBooking] organiser lookup failed:", err);
  }

  // The wallet discount renders as its own line on the Stripe page:
  // full price, then "Wallet credit −£X", then the remainder to pay.
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (plan.walletPence > 0) {
    try {
      const coupon = await stripe.coupons.create({
        amount_off: plan.walletPence,
        currency: "gbp",
        duration: "once",
        name: "Wallet credit",
      });
      discounts = [{ coupon: coupon.id }];
    } catch (err) {
      console.error("[initiateBooking] coupon create failed:", err);
      await releaseHold();
      return { error: "Couldn't start checkout. Please try again." };
    }
  }

  const buildParams = (destination: string | null) =>
    ({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: price.basePricePence,
            product_data: {
              name: `${game.format} at ${game.venue?.name ?? "KickOff game"}`,
              description: kickoffLabel,
            },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: price.feePence,
            product_data: { name: "Booking fee" },
          },
        },
      ],
      ...(discounts ? { discounts } : {}),
      // Wallet holds must not dangle: expire the session at Stripe's
      // minimum so an abandoned checkout frees the credit within the hour.
      ...(walletHoldId
        ? {
            expires_at:
              Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_SECONDS,
          }
        : {}),
      payment_intent_data: {
        // Save the card for Stage 8's waitlist auto-charging.
        setup_future_usage: "off_session" as const,
        // Waitlist joins are authorised, not captured — the money is only
        // taken if/when a spot opens (or at webhook time if one already has).
        ...(intendedStatus === "waitlist"
          ? { capture_method: "manual" as const }
          : {}),
        // Destination charge: organiser gets their share, we keep the fee
        // (reduced by any wallet credit — the transfer at settlement tops
        // the organiser up when the wallet ate into their share).
        ...(destination
          ? {
              transfer_data: { destination },
              // Omitted when the wallet already covered the whole fee — a
              // destination charge with no fee sends the organiser the lot.
              ...(plan.applicationFeePence > 0
                ? { application_fee_amount: plan.applicationFeePence }
                : {}),
            }
          : {}),
        metadata,
      },
      metadata,
      success_url: `${origin}/games/${gameId}?booked=1`,
      cancel_url: `${origin}/games/${gameId}`,
    }) satisfies Stripe.Checkout.SessionCreateParams;

  try {
    let session;
    try {
      session = await stripe.checkout.sessions.create(
        buildParams(connectDestination)
      );
    } catch (err) {
      if (!connectDestination) throw err;
      // The organiser's connected account may not be fully onboarded yet —
      // fall back to a plain platform charge rather than blocking the player.
      console.error(
        "[initiateBooking] destination charge failed, retrying without:",
        err
      );
      session = await stripe.checkout.sessions.create(buildParams(null));
    }
    if (!session.url) {
      await releaseHold();
      return { error: "Couldn't start checkout. Please try again." };
    }
    return { url: session.url };
  } catch (err) {
    console.error("[initiateBooking] checkout session failed:", err);
    await releaseHold();
    return { error: "Couldn't start checkout. Please try again." };
  }
}
