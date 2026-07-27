import type { PlayerTotal } from "@/lib/fees";

// How a booking's total splits between wallet credit and card, and what the
// organiser/platform split of the CARD portion must be so everyone still
// ends up whole.
//
// Invariant (the whole game): organiser always ends with basePricePence,
// platform always ends with feePence, player always pays totalPence — no
// matter how the wallet/card split falls.
//
//   card charge        = total − wallet
//   application fee    = max(0, fee − wallet)   (platform's cut of the card)
//   organiser via card = card − applicationFee
//   organiser transfer = max(0, wallet − fee)   (paid from platform balance)
//
// Check: organiserViaCard + transfer
//      = (total − wallet) − max(0, fee − wallet) + max(0, wallet − fee)
//      = total − fee = base. ✓  Platform: applicationFee + wallet − transfer
//      = fee. ✓
export type WalletApplication = {
  walletPence: number; // debited from the wallet
  cardPence: number; // charged to the card (0 = no Stripe involved)
  applicationFeePence: number; // platform's fee on the card charge
  organiserTransferPence: number; // owed to organiser from platform balance
};

export function planWalletApplication(
  price: PlayerTotal,
  walletBalancePence: number
): WalletApplication {
  const walletPence = Math.min(
    Math.max(walletBalancePence, 0),
    price.totalPence
  );
  return {
    walletPence,
    cardPence: price.totalPence - walletPence,
    applicationFeePence: Math.max(price.feePence - walletPence, 0),
    organiserTransferPence: Math.max(walletPence - price.feePence, 0),
  };
}

// The transfer owed for a booking given how much wallet was applied — used
// at settlement time (after confirmation), when the wallet amount is a fact
// on the booking row rather than a plan.
export function organiserTransferForWallet(
  walletAppliedPence: number,
  feePence: number
): number {
  return Math.max(walletAppliedPence - feePence, 0);
}
