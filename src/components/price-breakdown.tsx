import { Separator } from "@/components/ui/separator";
import type { PlayerTotal } from "@/lib/fees";
import { formatPence } from "@/lib/utils";

// Transparent Airbnb-style maths. When wallet credit will be applied the
// breakdown carries on past the total: credit off, remainder to pay.
export function PriceBreakdown({
  price,
  walletPence = 0,
}: {
  price: PlayerTotal;
  walletPence?: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Game</span>
        <span className="tabular-nums">{formatPence(price.basePricePence)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Booking fee</span>
        <span className="tabular-nums">{formatPence(price.feePence)}</span>
      </div>
      <Separator />
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatPence(price.totalPence)}</span>
      </div>
      {walletPence > 0 ? (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Wallet credit applied</span>
            <span className="tabular-nums text-primary">
              −{formatPence(walletPence)}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>To pay</span>
            <span className="tabular-nums">
              {formatPence(price.totalPence - walletPence)}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
