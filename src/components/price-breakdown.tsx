import { Separator } from "@/components/ui/separator";
import type { PlayerTotal } from "@/lib/fees";
import { formatPence } from "@/lib/utils";

export function PriceBreakdown({ price }: { price: PlayerTotal }) {
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
    </div>
  );
}
