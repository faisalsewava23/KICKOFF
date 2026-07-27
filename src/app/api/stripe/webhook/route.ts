import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { notifyBookingOutcome } from "@/lib/emails/notify";
import { settleWalletPayout } from "@/lib/payouts";
import { promoteAfterCancellation } from "@/lib/promotions";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object);
    } else if (event.type === "checkout.session.expired") {
      await handleCheckoutExpired(event.data.object);
    } else if (
      event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.payment_failed"
    ) {
      await handlePromotionPaymentEvent(event);
    }
  } catch (err) {
    console.error("[stripe webhook] handler failed:", err);
    // Non-2xx makes Stripe retry — all handlers are idempotent, so that's safe.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const gameId = session.metadata?.game_id;
  const userId = session.metadata?.user_id;
  const intendedStatus = session.metadata?.intended_status;
  const walletHoldId = session.metadata?.wallet_hold_id;
  if (!gameId || !userId) {
    console.error("[stripe webhook] session missing metadata:", session.id);
    return;
  }
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const db = createAdminClient();

  // Idempotency: webhook retries and double-sends must not duplicate.
  const { data: existing } = await db
    .from("bookings")
    .select("id, status, stripe_payment_intent, payment_generation")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    // Same payment intent → this exact event was already processed. That
    // includes cancelled rows: a replay must never resurrect a booking the
    // player has since cancelled. (A genuine rejoin arrives with a NEW
    // checkout session and payment intent, which passes through.)
    if (existing.stripe_payment_intent === paymentIntentId) {
      return;
    }
    if (existing.status !== "cancelled") {
      // Live booking from another flow — don't clobber. Any wallet hold on
      // this abandoned session is released by the janitor.
      return;
    }
  }

  // The payment charged total-minus-wallet, so the hold is now real spend.
  // Consume is idempotent (replays return the same amount).
  let walletApplied = 0;
  if (walletHoldId) {
    const { data: consumed, error: consumeError } = await db.rpc(
      "consume_wallet_hold",
      { p_hold_id: walletHoldId }
    );
    if (consumeError) {
      throw new Error(`wallet hold consume failed: ${consumeError.message}`);
    }
    if (consumed === null) {
      // Hold was already released AND the credit has since been spent — the
      // player paid the discounted price and keeps the released credit.
      // Platform absorbs it; flag for a human.
      console.error(
        `[stripe webhook] MONEY: hold ${walletHoldId} unrecoverable for session ${session.id} — booking recorded with wallet_applied=0`
      );
    } else {
      walletApplied = consumed;
    }
  }

  // The webhook recount is the source of truth for confirmed vs waitlist —
  // two players can complete checkout for the last spot at the same time.
  const { status, waitlistPosition } = await decideStatus(db, gameId);

  // Waitlist checkouts are authorised, not captured. If a spot is actually
  // free by the time the webhook lands, take the payment now.
  if (
    status === "confirmed" &&
    intendedStatus === "waitlist" &&
    paymentIntentId
  ) {
    try {
      await getStripe().paymentIntents.capture(paymentIntentId);
    } catch (err) {
      console.error("[stripe webhook] capture failed:", paymentIntentId, err);
    }
  }

  const { data: upserted, error } = await db
    .from("bookings")
    .upsert(
      {
        game_id: gameId,
        user_id: userId,
        status,
        waitlist_position: waitlistPosition,
        stripe_payment_intent: paymentIntentId,
        wallet_applied_pence: walletApplied,
        // Rebooking a cancelled row is a NEW payment for an old row — bump
        // the generation so its payout settles separately from past lives.
        payment_generation: existing ? existing.payment_generation + 1 : 0,
      },
      { onConflict: "game_id,user_id" } // a cancelled row becomes the new booking
    )
    .select("id")
    .single();
  if (error) {
    throw new Error(`bookings upsert failed: ${error.message}`);
  }

  // Wallet-covered share of the organiser's money moves at confirmation.
  if (status === "confirmed" && walletApplied > 0 && upserted) {
    await settleWalletPayout(upserted.id);
  }

  await notifyBookingOutcome(gameId, userId, status, waitlistPosition);
}

// Abandoned part-wallet checkout: Stripe expired the session (we set the
// 30-minute minimum), so the wallet debit goes straight back. Idempotent.
async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const walletHoldId = session.metadata?.wallet_hold_id;
  if (!walletHoldId) return;
  const db = createAdminClient();
  const { data: released, error } = await db.rpc("release_wallet_hold", {
    p_hold_id: walletHoldId,
  });
  if (error) {
    throw new Error(`wallet hold release failed: ${error.message}`);
  }
  if (released) {
    console.log(
      `[stripe webhook] released wallet hold ${walletHoldId} (checkout expired)`
    );
  }
}

// Reconciliation for promotion charges: if the app crashed between charging
// and recording the outcome, these events settle the booking — and a failed
// promotion frees the spot for the next in line.
async function handlePromotionPaymentEvent(
  event: Stripe.PaymentIntentSucceededEvent | Stripe.PaymentIntentPaymentFailedEvent
) {
  const pi = event.data.object;
  if (pi.metadata?.promotion !== "true" || !pi.metadata.booking_id) {
    return; // not a promotion charge (e.g. ordinary checkout PI)
  }
  const db = createAdminClient();
  const outcome =
    event.type === "payment_intent.succeeded" ? "confirmed" : "cancelled";
  const { data: applied, error } = await db.rpc("resolve_waitlist_booking", {
    p_booking_id: pi.metadata.booking_id,
    p_outcome: outcome,
    p_new_payment_intent: pi.id,
  });
  if (error) {
    throw new Error(`promotion resolve failed: ${error.message}`);
  }
  if (applied && outcome === "confirmed") {
    // A part-wallet waitlist booking just confirmed — settle the wallet
    // share with the organiser (no-op when nothing is owed).
    await settleWalletPayout(pi.metadata.booking_id);
  }
  if (applied && outcome === "cancelled" && pi.metadata.game_id) {
    // The claimed spot is free again — continue down the queue. (The
    // resolve RPC already refunded any wallet debit on this booking.)
    await promoteAfterCancellation(pi.metadata.game_id);
  }
}

async function decideStatus(
  db: ReturnType<typeof createAdminClient>,
  gameId: string
): Promise<{ status: string; waitlistPosition: number | null }> {
  const [{ count: confirmedCount }, { data: game }] = await Promise.all([
    db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId)
      // 'promoting' is a spot mid-handover — it counts against capacity
      // here exactly as it does in the SQL claim/booking functions.
      .in("status", ["confirmed", "promoting"]),
    db.from("games").select("max_players").eq("id", gameId).single(),
  ]);

  if ((confirmedCount ?? 0) < (game?.max_players ?? 0)) {
    return { status: "confirmed", waitlistPosition: null };
  }

  const { data: lastInQueue } = await db
    .from("bookings")
    .select("waitlist_position")
    .eq("game_id", gameId)
    .eq("status", "waitlist")
    .order("waitlist_position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    status: "waitlist",
    waitlistPosition: (lastInQueue?.waitlist_position ?? 0) + 1,
  };
}
