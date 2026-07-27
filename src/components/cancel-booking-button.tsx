"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPence } from "@/lib/utils";
import { cancelBooking } from "@/app/(app)/bookings/actions";

export function CancelBookingButton({
  bookingId,
  refundable,
  refundPence,
  isWaitlist,
  walletHeldPence = 0,
}: {
  bookingId: string;
  // Computed server-side: confirmed booking, more than 6h to kickoff.
  refundable: boolean;
  refundPence: number;
  isWaitlist: boolean;
  // Wallet credit held against a waitlist spot — refunded on leaving.
  walletHeldPence?: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirmCancel() {
    startTransition(async () => {
      const result = await cancelBooking(bookingId);
      if (result.success) {
        toast(
          result.refundedPence
            ? isWaitlist
              ? `You've left the waitlist — ${formatPence(result.refundedPence)} is back in your wallet.`
              : `Cancelled — ${formatPence(result.refundedPence)} is back in your wallet.`
            : isWaitlist
              ? "You've left the waitlist."
              : "Booking cancelled."
        );
        setOpen(false);
      } else {
        toast.error(result.error ?? "Couldn't cancel. Please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline active:scale-95 transition-all">
        {isWaitlist ? "Leave waitlist" : "Cancel booking"}
      </DialogTrigger>
      <DialogContent className="max-w-[340px]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isWaitlist
              ? "Leave the waitlist?"
              : refundable
                ? "Cancel this booking?"
                : "Cancel without a refund?"}
          </DialogTitle>
          <DialogDescription>
            {isWaitlist
              ? walletHeldPence > 0
                ? `${formatPence(walletHeldPence)} goes straight back to your wallet the moment you leave — your card is never charged. Everyone behind you moves up a place.`
                : "You haven't been charged and won't be — leaving the waitlist is free. Everyone behind you moves up a place."
              : refundable
                ? `${formatPence(refundPence)} goes straight back to your KickOff wallet.`
                : "Kickoff is less than 6 hours away, so cancelling now forfeits what you paid. This can't be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="ghost"
            className="active:scale-95 transition-all"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {isWaitlist ? "Stay on it" : "Keep my spot"}
          </Button>
          <Button
            variant={refundable || isWaitlist ? "default" : "destructive"}
            className="active:scale-95 transition-all"
            onClick={confirmCancel}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : isWaitlist ? (
              "Leave waitlist"
            ) : refundable ? (
              "Cancel booking"
            ) : (
              "Cancel anyway"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
