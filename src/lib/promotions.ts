// Waitlist auto-promotion. Server-side only — touches Stripe and the
// service-role client. Runs after any confirmed spot frees up on an open
// game (player cancellation) and from the Stripe webhook's reconciliation.
//
// Money safety, in short:
// - The DB claim (status='promoting') is taken under a per-game row lock,
//   so a booking can only ever be claimed once at a time.
// - Charging is idempotent: we first try to CAPTURE the original checkout
//   authorisation (capturing twice is impossible), and only if that
//   authorisation is gone do we create a fresh off-session PaymentIntent
//   with a deterministic idempotency key (`promotion-<bookingId>`), so
//   retries and crashes can never produce two charges.
// - The outcome write (resolve) is idempotent in SQL; webhook replays no-op.
import type Stripe from "stripe";
import { notifyPromotion } from "@/lib/emails/notify";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type Claim = {
  booking_id: string;
  user_id: string;
  stripe_payment_intent: string | null;
  claimed_position: number | null;
  resumed: boolean;
};

type ChargeOutcome = {
  ok: boolean;
  newPaymentIntentId: string | null;
};

const MAX_CHAIN_LENGTH = 30;

// Fills freed spots from the waitlist until either a charge succeeds for
// each free spot or the waitlist is exhausted. Safe to call repeatedly and
// concurrently — the claim RPC serialises per game.
export async function promoteAfterCancellation(gameId: string): Promise<void> {
  const db = createAdminClient();

  for (let i = 0; i < MAX_CHAIN_LENGTH; i++) {
    const { data, error } = await db.rpc("claim_next_waitlist_promotion", {
      p_game_id: gameId,
    });
    if (error) {
      console.error("[promotion] claim failed:", error.message);
      return;
    }
    const claim = data?.[0];
    if (!claim) return; // no free spot, or waitlist empty — done

    const outcome = await attemptPromotionCharge(claim);

    const { error: resolveError } = await db.rpc("resolve_waitlist_booking", {
      p_booking_id: claim.booking_id,
      p_outcome: outcome.ok ? "confirmed" : "cancelled",
      p_new_payment_intent: outcome.newPaymentIntentId,
    });
    if (resolveError) {
      // The booking stays 'promoting'; the next run or the webhook heals it.
      console.error("[promotion] resolve failed:", resolveError.message);
      return;
    }
    console.log(
      `[promotion] booking ${claim.booking_id} -> ${outcome.ok ? "confirmed" : "cancelled"}` +
        (claim.resumed ? " (resumed)" : "")
    );
    if (outcome.ok) {
      // The receipt email — sent after the money moved, never before.
      await notifyPromotion(
        gameId,
        claim.user_id,
        outcome.newPaymentIntentId ?? claim.stripe_payment_intent
      );
      // Spot filled. Loop again: another spot may also be free.
      continue;
    }
  }
}

// Charge exactly what the player agreed to at checkout: their original
// authorisation. Falls back to an off-session charge of the same amount on
// the same saved card if the authorisation has expired.
async function attemptPromotionCharge(claim: Claim): Promise<ChargeOutcome> {
  if (!claim.stripe_payment_intent) {
    // No payment intent on file (e.g. admin-created row): can't charge.
    return { ok: false, newPaymentIntentId: null };
  }
  const stripe = getStripe();

  let original: Stripe.PaymentIntent;
  try {
    original = await stripe.paymentIntents.retrieve(claim.stripe_payment_intent);
  } catch (err) {
    console.error("[promotion] PI retrieve failed:", err);
    return { ok: false, newPaymentIntentId: null };
  }

  if (original.status === "succeeded") {
    // Crash-recovery path: charge already went through previously.
    return { ok: true, newPaymentIntentId: null };
  }

  if (original.status === "requires_capture") {
    try {
      await stripe.paymentIntents.capture(original.id);
      return { ok: true, newPaymentIntentId: null };
    } catch (err) {
      console.error("[promotion] capture failed, trying fresh charge:", err);
    }
  }

  return freshOffSessionCharge(stripe, claim, original);
}

async function freshOffSessionCharge(
  stripe: Stripe,
  claim: Claim,
  original: Stripe.PaymentIntent
): Promise<ChargeOutcome> {
  const paymentMethod =
    typeof original.payment_method === "string"
      ? original.payment_method
      : original.payment_method?.id;
  const customer =
    typeof original.customer === "string"
      ? original.customer
      : original.customer?.id;
  if (!paymentMethod || !customer) {
    return { ok: false, newPaymentIntentId: null };
  }

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: original.amount, // the amount they agreed to — never recomputed
        currency: original.currency,
        customer,
        payment_method: paymentMethod,
        off_session: true,
        confirm: true,
        ...(original.transfer_data?.destination
          ? {
              transfer_data: {
                destination:
                  typeof original.transfer_data.destination === "string"
                    ? original.transfer_data.destination
                    : original.transfer_data.destination.id,
              },
              application_fee_amount:
                original.application_fee_amount ?? undefined,
            }
          : {}),
        metadata: {
          game_id: (original.metadata?.game_id as string) ?? "",
          user_id: claim.user_id,
          booking_id: claim.booking_id,
          promotion: "true",
        },
      },
      { idempotencyKey: `promotion-${claim.booking_id}` }
    );
    if (pi.status === "succeeded") {
      return { ok: true, newPaymentIntentId: pi.id };
    }
    // requires_action (3DS) can't be completed by an absent user — decline.
    await cancelQuietly(stripe, pi.id);
    return { ok: false, newPaymentIntentId: pi.id };
  } catch (err) {
    // Declines throw; the PI (if one was created) rides along on the error.
    const stripeErr = err as { payment_intent?: { id?: string } };
    console.error("[promotion] off-session charge declined/failed:", err);
    return {
      ok: false,
      newPaymentIntentId: stripeErr.payment_intent?.id ?? null,
    };
  }
}

async function cancelQuietly(stripe: Stripe, paymentIntentId: string) {
  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
  } catch {
    // best-effort cleanup of an unconfirmable intent
  }
}
