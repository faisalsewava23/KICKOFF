// Platform fee: 4% of the organiser's price, added on top — the player pays
// the total, the organiser receives their full price (PROJECT.md business
// rules).

export const PLATFORM_FEE_PERCENT = 4;

export type PlayerTotal = {
  basePricePence: number;
  feePence: number;
  totalPence: number;
};

// Worked examples:
//   £8.00 game → 800 × 4% = 32.0p  → fee 32p → player pays £8.32
//   £6.10 game → 610 × 4% = 24.4p  → fee 25p → player pays £6.35
//   £9.90 game → 990 × 4% = 39.6p  → fee 40p → player pays £10.30
export function calculatePlayerTotal(basePricePence: number): PlayerTotal {
  if (!Number.isInteger(basePricePence) || basePricePence < 0) {
    throw new Error(
      `basePricePence must be a non-negative integer, got ${basePricePence}`
    );
  }

  // Integer maths (×4 ÷100) so floating point can never distort the fee;
  // round up to the next penny so the fee is never below a true 4%.
  const feePence = Math.ceil((basePricePence * PLATFORM_FEE_PERCENT) / 100);

  return {
    basePricePence,
    feePence,
    totalPence: basePricePence + feePence,
  };
}
