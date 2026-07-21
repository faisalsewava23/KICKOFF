"use client";

import { calculatePlayerTotal } from "@/lib/fees";
import { formatPence } from "@/lib/utils";

// Live money preview under the price input — same maths as checkout.
export function FeePreview({ pricePounds }: { pricePounds: string }) {
  const parsed = Number.parseFloat(pricePounds);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 50) {
    return (
      <p className="text-sm text-muted-foreground">
        Set a price between £1 and £50 to see what players will pay.
      </p>
    );
  }

  const price = calculatePlayerTotal(Math.round(parsed * 100));
  return (
    <p className="text-sm text-muted-foreground">
      Players will pay{" "}
      <span className="font-semibold text-foreground tabular-nums">
        {formatPence(price.totalPence)}
      </span>{" "}
      ({formatPence(price.basePricePence)} + {formatPence(price.feePence)}{" "}
      booking fee). You receive{" "}
      <span className="font-semibold text-foreground tabular-nums">
        {formatPence(price.basePricePence)}
      </span>{" "}
      per player.
    </p>
  );
}
