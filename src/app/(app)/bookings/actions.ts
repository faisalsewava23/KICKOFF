"use server";

import { revalidatePath } from "next/cache";
import { sendBookingCancelledEmail } from "@/lib/emails/booking-cancelled";
import { appUrl, kickoffLabel } from "@/lib/emails/notify";
import { calculatePlayerTotal } from "@/lib/fees";
import { promoteAfterCancellation } from "@/lib/promotions";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatPence } from "@/lib/utils";

export type CancelBookingResult = {
  success: boolean;
  refundedPence?: number;
  error?: string;
};

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// PROJECT.md cancellation rule: more than 6 hours before kickoff → full
// refund to wallet credit. Within 6 hours → no refund. Waitlist bookings
// were only authorised, never charged — cancelling releases the hold.
export async function cancelBooking(
  bookingId: string
): Promise<CancelBookingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "You need to be logged in." };
  }

  // Read with the user's own client — RLS guarantees it's their booking.
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, game:games(*, venue:venues(name, address, postcode))")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!booking || booking.status === "cancelled") {
    return { success: false, error: "Booking not found." };
  }
  if (!booking.game) {
    return { success: false, error: "This game is no longer available." };
  }
  const kickoff = new Date(booking.game.kickoff_at).getTime();
  if (kickoff <= Date.now()) {
    return { success: false, error: "This game has already kicked off." };
  }

  const wasConfirmed = booking.status === "confirmed";
  const refundable = wasConfirmed && kickoff - Date.now() > SIX_HOURS_MS;

  // Bookings have no user-side update policy by design — mutations go
  // through the service role after the ownership check above.
  const admin = createAdminClient();

  if (booking.status === "waitlist") {
    // Self-cancel from the waitlist: free anytime, and everyone behind
    // shifts up one (atomic in SQL, shared with the promotion machinery).
    const { error: resolveError } = await admin.rpc(
      "resolve_waitlist_booking",
      { p_booking_id: booking.id, p_outcome: "cancelled" }
    );
    if (resolveError) {
      console.error("[cancelBooking] waitlist resolve failed:", resolveError.message);
      return { success: false, error: "Couldn't cancel. Please try again." };
    }
    // Release the uncaptured authorisation — they were never charged.
    if (booking.stripe_payment_intent) {
      try {
        await getStripe().paymentIntents.cancel(booking.stripe_payment_intent);
      } catch (err) {
        console.error("[cancelBooking] auth release failed:", err);
      }
    }
  } else {
    const { error: cancelError } = await admin
      .from("bookings")
      .update({ status: "cancelled", waitlist_position: null })
      .eq("id", booking.id);
    if (cancelError) {
      console.error("[cancelBooking] update failed:", cancelError.message);
      return { success: false, error: "Couldn't cancel. Please try again." };
    }
  }

  let refundedPence: number | undefined;
  if (refundable) {
    refundedPence = calculatePlayerTotal(booking.game.price_pence).totalPence;
    const { data: profile } = await admin
      .from("profiles")
      .select("wallet_balance_pence")
      .eq("id", user.id)
      .single();
    const { error: walletError } = await admin
      .from("profiles")
      .update({
        wallet_balance_pence:
          (profile?.wallet_balance_pence ?? 0) + refundedPence,
      })
      .eq("id", user.id);
    if (walletError) {
      console.error("[cancelBooking] wallet credit failed:", walletError.message);
      return {
        success: false,
        error: "Cancelled, but the refund hit a snag — contact support.",
      };
    }
  }

  // Cancellation email for confirmed bookings (waitlist leavers were never
  // charged — the in-app state is enough there).
  if (wasConfirmed && user.email) {
    const { data: freshProfile } = await admin
      .from("profiles")
      .select("wallet_balance_pence")
      .eq("id", user.id)
      .single();
    await sendBookingCancelledEmail({
      to: user.email,
      venueName: booking.game.venue?.name ?? "the venue",
      venueAddress: [booking.game.venue?.address, booking.game.venue?.postcode]
        .filter(Boolean)
        .join(", "),
      kickoffLabel: kickoffLabel(booking.game.kickoff_at),
      refundedLabel: refundedPence ? formatPence(refundedPence) : null,
      walletLabel: formatPence(freshProfile?.wallet_balance_pence ?? 0),
      gameUrl: appUrl(`/games/${booking.game.id}`),
    });
  }

  // A freed confirmed spot on a live game heals itself from the waitlist.
  // Awaited deliberately: with no cron, this request is the only guaranteed
  // execution context (the webhook reconciles any crash mid-way).
  if (wasConfirmed && kickoff > Date.now()) {
    await promoteAfterCancellation(booking.game.id);
  }

  revalidatePath("/bookings");
  revalidatePath(`/games/${booking.game.id}`);
  revalidatePath("/games");

  return { success: true, refundedPence };
}
