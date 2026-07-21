"use server";

import { headers } from "next/headers";
import type Stripe from "stripe";
import { format } from "date-fns";
import { calculatePlayerTotal } from "@/lib/fees";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type InitiateBookingResult = { url?: string; error?: string };

// Starts a Stripe Checkout for a game. Everything is re-validated and
// recomputed server-side — the client sends nothing but the game id.
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

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[initiateBooking] STRIPE_SECRET_KEY is not set");
    return {
      error: "Payments aren't switched on yet — hang tight, coming soon.",
    };
  }
  const stripe = getStripe();

  // One Stripe Customer per profile, created lazily and reused — this is
  // what lets Stage 8 charge saved payment methods off-session.
  let customerId: string | null = null;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    customerId = profile?.stripe_customer_id ?? null;
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

  const kickoffLabel = format(new Date(game.kickoff_at), "EEE d MMM, HH:mm");
  const metadata = {
    game_id: gameId,
    user_id: user.id,
    intended_status: intendedStatus,
  };

  // Connect split: organisers with a connected account get their share
  // routed automatically at payment time — we keep exactly the platform fee.
  // The organiser's profile isn't readable by the booker's RLS, so look it
  // up with the service role (server-side only). Seed games (no connected
  // account) keep the plain platform-charge behaviour.
  let connectDestination: string | null = null;
  try {
    const { data: organiserProfile } = await createAdminClient()
      .from("profiles")
      .select("stripe_connect_id")
      .eq("id", game.organiser_id)
      .maybeSingle();
    connectDestination = organiserProfile?.stripe_connect_id ?? null;
  } catch (err) {
    console.error("[initiateBooking] organiser lookup failed:", err);
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
      payment_intent_data: {
        // Save the card for Stage 8's waitlist auto-charging.
        setup_future_usage: "off_session" as const,
        // Waitlist joins are authorised, not captured — the money is only
        // taken if/when a spot opens (or at webhook time if one already has).
        ...(intendedStatus === "waitlist"
          ? { capture_method: "manual" as const }
          : {}),
        // Destination charge: organiser gets base price, we keep the fee.
        ...(destination
          ? {
              transfer_data: { destination },
              application_fee_amount: price.feePence,
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
      return { error: "Couldn't start checkout. Please try again." };
    }
    return { url: session.url };
  } catch (err) {
    console.error("[initiateBooking] checkout session failed:", err);
    return { error: "Couldn't start checkout. Please try again." };
  }
}
