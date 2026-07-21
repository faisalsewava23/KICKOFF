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
import { cancelGame } from "@/app/(app)/organiser/games/[id]/actions";

export function CancelGameButton({
  gameId,
  confirmedCount,
  waitlistCount,
}: {
  gameId: string;
  confirmedCount: number;
  waitlistCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirmCancel() {
    startTransition(async () => {
      const result = await cancelGame(gameId);
      if (result.success) {
        toast(
          result.refundedCount
            ? `Game cancelled — ${result.refundedCount} player${result.refundedCount === 1 ? "" : "s"} refunded in full.`
            : "Game cancelled."
        );
        setOpen(false);
      } else {
        toast.error(result.error ?? "Couldn't cancel the game.");
      }
    });
  }

  const parts: string[] = [];
  if (confirmedCount > 0) {
    parts.push(
      `${confirmedCount === 1 ? "the 1 confirmed player gets" : `all ${confirmedCount} confirmed players get`} a full refund (game price + booking fee) to their KickOff wallet`
    );
  }
  if (waitlistCount > 0) {
    parts.push(
      `${waitlistCount === 1 ? "1 waitlisted player gets" : `${waitlistCount} waitlisted players get`} their card hold released — they were never charged`
    );
  }
  const consequences =
    parts.length > 0
      ? `Here's exactly what happens: ${parts.join("; ")}; the game comes off the games list. This can't be undone.`
      : "The game comes off the games list. This can't be undone.";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline active:scale-95 transition-all">
        Cancel this game
      </DialogTrigger>
      <DialogContent className="max-w-[340px]">
        <DialogHeader>
          <DialogTitle className="font-heading">Cancel this game?</DialogTitle>
          <DialogDescription>{consequences}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="active:scale-95 transition-all"
          >
            Keep the game
          </Button>
          <Button
            variant="destructive"
            onClick={confirmCancel}
            disabled={isPending}
            className="active:scale-95 transition-all"
          >
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              "Cancel game"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
