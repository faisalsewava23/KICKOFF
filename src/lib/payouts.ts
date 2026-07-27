// Organiser settlement for wallet-covered money. Server-side only.
//
// Why this exists: when a player pays (partly) with wallet credit, that part
// of the money never flows through a Stripe payment — the cash is already
// sitting in the platform's Stripe balance from the original charge that
// funded the credit. So the organiser's share of the wallet-covered portion
// is paid with a Stripe TRANSFER from the platform balance, recorded in
// organiser_payouts.
//
// Double-pay/short-pay safety: a booking row is reused when a player
// cancels and rebooks the same game, so payouts key on booking id PLUS the
// booking's payment_generation (payout_key) — one settled row per paid
// life, and the Stripe transfer carries an idempotency key derived from the
// same payout_key. Failures leave the row 'pending'; the daily cron retries
// the ROW (its own life's amount), never recomputing from the current
// booking state.
//
// A transfer is only owed when wallet_applied exceeds the platform fee (see
// src/lib/wallet.ts): below that, the card charge's reduced application fee
// already makes the organiser whole.
import { calculatePlayerTotal } from "@/lib/fees";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { organiserTransferForWallet } from "@/lib/wallet";

type PayoutRow = {
  id: string;
  payout_key: string | null;
  amount_pence: number;
  status: string;
  organiser_id: string;
};

// Idempotent, safe to call from every place a booking becomes confirmed.
// Never throws — a settlement hiccup must not break a booking flow.
export async function settleWalletPayout(bookingId: string): Promise<void> {
  try {
    const db = createAdminClient();

    const { data: booking } = await db
      .from("bookings")
      .select(
        "id, status, wallet_applied_pence, payment_generation, game:games(id, price_pence, organiser_id)"
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking || booking.status !== "confirmed" || !booking.game) return;

    const owed = organiserTransferForWallet(
      booking.wallet_applied_pence,
      calculatePlayerTotal(booking.game.price_pence).feePence
    );
    if (owed <= 0) return;

    const payoutKey = `${bookingId}:g${booking.payment_generation}`;

    // One payout row per paid life of the booking. ignoreDuplicates keeps
    // the original row (and its status) if a webhook replay races us.
    const { error: insertError } = await db.from("organiser_payouts").upsert(
      {
        payout_key: payoutKey,
        booking_id: bookingId,
        organiser_id: booking.game.organiser_id,
        game_id: booking.game.id,
        amount_pence: owed,
        status: "pending",
      },
      { onConflict: "payout_key", ignoreDuplicates: true }
    );
    if (insertError) {
      console.error("[payout] payout row upsert failed:", insertError.message);
      return;
    }

    const { data: payout } = await db
      .from("organiser_payouts")
      .select("id, payout_key, amount_pence, status, organiser_id")
      .eq("payout_key", payoutKey)
      .single();
    if (!payout || payout.status === "paid") return;

    await executeTransfer(db, payout);
  } catch (err) {
    console.error(`[payout] settle failed for booking ${bookingId}:`, err);
  }
}

// Pays one pending payout row. Two hard-won safety rules:
//
// 1. A FIXED Stripe idempotency key cannot be used for retries: Stripe
//    caches error responses under the key too (seen live: a
//    balance_insufficient failure was replayed verbatim on retry after the
//    balance was topped up — `idempotent-replayed: true`). So each attempt
//    uses a fresh key, and double-pay is prevented one level up:
// 2. The DB row is claimed first (pending → processing, atomic — only one
//    caller wins), and every transfer carries transfer_group = payout_key,
//    so a crashed attempt is discoverable: before creating a transfer we
//    look the group up and adopt an existing one instead of paying again.
async function executeTransfer(
  db: ReturnType<typeof createAdminClient>,
  payout: PayoutRow
): Promise<boolean> {
  const { data: organiser } = await db
    .from("profiles")
    .select("stripe_connect_id")
    .eq("id", payout.organiser_id)
    .maybeSingle();
  if (!organiser?.stripe_connect_id) {
    // Same as their card bookings today: no connected account means the
    // money stays in the platform balance and is settled by hand. The row
    // stays pending so it's picked up if they connect later.
    console.log(
      `[payout] ${payout.payout_key}: organiser has no connected account yet`
    );
    return false;
  }
  if (!payout.payout_key) return false;

  // Claim the row. Zero rows updated = someone else is on it (or it's done).
  const { data: claimed, error: claimError } = await db
    .from("organiser_payouts")
    .update({ status: "processing" })
    .eq("id", payout.id)
    .eq("status", payout.status) // pending, or processing when adopting
    .select("id");
  if (claimError || !claimed?.length) return false;

  const markPaid = async (transferId: string) => {
    const { error } = await db
      .from("organiser_payouts")
      .update({
        status: "paid",
        stripe_transfer_id: transferId,
        paid_at: new Date().toISOString(),
      })
      .eq("id", payout.id);
    if (error) console.error("[payout] paid-mark failed:", error.message);
  };
  const revertToPending = async () => {
    const { error } = await db
      .from("organiser_payouts")
      .update({ status: "pending" })
      .eq("id", payout.id);
    if (error) console.error("[payout] revert failed:", error.message);
  };

  try {
    const stripe = getStripe();

    // Crash recovery: a previous attempt may have created the transfer and
    // died before recording it.
    const existing = await stripe.transfers.list({
      transfer_group: payout.payout_key,
      limit: 1,
    });
    if (existing.data[0]) {
      await markPaid(existing.data[0].id);
      return true;
    }

    const transfer = await stripe.transfers.create(
      {
        amount: payout.amount_pence,
        currency: "gbp",
        destination: organiser.stripe_connect_id,
        transfer_group: payout.payout_key,
        description: `KickOff wallet-paid booking (${payout.payout_key})`,
        metadata: { payout_key: payout.payout_key },
      },
      // Fresh key per attempt (see rule 1); the claim + transfer_group
      // check above are what make attempts single-winner.
      { idempotencyKey: `wallet-payout-${payout.payout_key}-${Date.now()}` }
    );
    await markPaid(transfer.id);
    return true;
  } catch (err) {
    // Likely cause in live mode: platform balance not yet available. Back
    // to 'pending'; the daily cron retries.
    console.error(`[payout] transfer failed for ${payout.payout_key}:`, err);
    await revertToPending();
    return false;
  }
}

// Daily-cron janitor: pending rows get another go, and rows stuck in
// 'processing' (a crashed attempt) are adopted-or-retried — the
// transfer_group lookup inside executeTransfer makes that double-pay-safe.
export async function retryPendingWalletPayouts(): Promise<number> {
  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("organiser_payouts")
    .select("id, payout_key, amount_pence, status, organiser_id")
    .in("status", ["pending", "processing"])
    .not("payout_key", "is", null);
  if (error) {
    console.error("[payout] pending query failed:", error.message);
    return 0;
  }
  let paid = 0;
  for (const row of rows ?? []) {
    if (await executeTransfer(db, row)) paid += 1;
  }
  return paid;
}
