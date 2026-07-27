// High-level "something happened → email the right person" helpers.
// Server-side only; every path swallows its own errors (fire-and-forget).
import { format } from "date-fns";
import { calculatePlayerTotal } from "@/lib/fees";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPence } from "@/lib/utils";
import { sendBookingConfirmedEmail } from "./booking-confirmed";
import { sendPromotedEmail } from "./promoted";
import { sendWaitlistJoinedEmail } from "./waitlist-joined";

export function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

export function kickoffLabel(iso: string): string {
  return format(new Date(iso), "EEEE d MMMM, HH:mm");
}

async function gatherBookingContext(gameId: string, userId: string) {
  const db = createAdminClient();
  const [{ data: game }, { data: profile }] = await Promise.all([
    db
      .from("games")
      .select("kickoff_at, price_pence, venue:venues(name, address, postcode)")
      .eq("id", gameId)
      .maybeSingle(),
    db.from("profiles").select("email").eq("id", userId).maybeSingle(),
  ]);
  if (!game || !profile?.email) return null;
  return {
    to: profile.email,
    venueName: game.venue?.name ?? "the venue",
    venueAddress: [game.venue?.address, game.venue?.postcode]
      .filter(Boolean)
      .join(", "),
    kickoffLabel: kickoffLabel(game.kickoff_at),
    amountLabel: formatPence(calculatePlayerTotal(game.price_pence).totalPence),
    gameUrl: appUrl(`/games/${gameId}`),
  };
}

// After the checkout webhook writes a booking: confirmed or waitlist email.
export async function notifyBookingOutcome(
  gameId: string,
  userId: string,
  status: string,
  waitlistPosition: number | null
): Promise<void> {
  try {
    const ctx = await gatherBookingContext(gameId, userId);
    if (!ctx) return;
    if (status === "confirmed") {
      await sendBookingConfirmedEmail(ctx);
    } else if (status === "waitlist") {
      await sendWaitlistJoinedEmail({ ...ctx, position: waitlistPosition });
    }
  } catch (err) {
    console.error("[email] notifyBookingOutcome failed:", err);
  }
}

// After a successful waitlist promotion: the receipt nobody should learn
// about from their bank statement.
export async function notifyPromotion(
  gameId: string,
  userId: string,
  paymentIntentId: string | null,
  walletAppliedPence = 0
): Promise<void> {
  try {
    const ctx = await gatherBookingContext(gameId, userId);
    if (!ctx) return;
    let cardLabel =
      walletAppliedPence > 0 && !paymentIntentId
        ? "your KickOff wallet"
        : "your saved card";
    if (paymentIntentId) {
      try {
        const pi = await getStripe().paymentIntents.retrieve(paymentIntentId, {
          expand: ["latest_charge"],
        });
        const charge =
          typeof pi.latest_charge === "object" ? pi.latest_charge : null;
        const card = charge?.payment_method_details?.card;
        if (card?.brand && card.last4) {
          cardLabel = `${card.brand.charAt(0).toUpperCase()}${card.brand.slice(1)} ending ${card.last4}`;
        }
        if (walletAppliedPence > 0) {
          cardLabel += ` (plus ${formatPence(walletAppliedPence)} wallet credit)`;
        }
        // The promoted player pays what they agreed at checkout time —
        // the card amount plus any wallet credit put down at join.
        ctx.amountLabel = formatPence(pi.amount + walletAppliedPence);
      } catch (err) {
        console.error("[email] promotion card lookup failed:", err);
      }
    } else if (walletAppliedPence > 0) {
      ctx.amountLabel = formatPence(walletAppliedPence);
    }
    await sendPromotedEmail({ ...ctx, cardLabel });
  } catch (err) {
    console.error("[email] notifyPromotion failed:", err);
  }
}
