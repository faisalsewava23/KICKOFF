"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, formatPence } from "@/lib/utils";
import { initiateBooking } from "@/app/(app)/games/[id]/actions";

export type JoinState = "join" | "waitlist" | "confirmed" | "on_waitlist";

const CTA_CLASSES = "h-14 px-8 text-base font-semibold active:scale-95 transition-all";

export function JoinButton({
  state,
  gameId,
  loginHref,
}: {
  state: JoinState;
  gameId: string;
  // Set for logged-out visitors: the CTA sends them to log in with intent.
  loginHref?: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (state === "confirmed") {
    return (
      <p className="flex items-center gap-2 font-heading font-semibold">
        <CircleCheck className="size-5 text-primary" aria-hidden />
        You&apos;re in — see you there.
      </p>
    );
  }

  if (state === "on_waitlist") {
    return (
      <p className="flex items-center gap-2 font-heading font-semibold">
        <CircleCheck className="size-5 text-primary" aria-hidden />
        You&apos;re on the waitlist.
      </p>
    );
  }

  const label = state === "join" ? "Join game" : "Join waitlist";

  if (loginHref) {
    return (
      <Link href={loginHref} className={cn(buttonVariants(), CTA_CLASSES)}>
        {label}
      </Link>
    );
  }

  return (
    <Button
      className={CTA_CLASSES}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await initiateBooking(gameId);
          if (result.url) {
            window.location.assign(result.url);
          } else if (result.booked) {
            // Wallet covered the lot — no Stripe. Full navigation so the
            // server re-renders the page with the booking + success banner.
            window.location.assign(`/games/${gameId}?booked=1`);
          } else {
            toast.error(
              result.error ?? "Couldn't start checkout. Please try again."
            );
          }
        })
      }
    >
      {isPending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          One sec…
        </>
      ) : (
        label
      )}
    </Button>
  );
}

// Airbnb-style sticky booking bar: total on the left, CTA on the right.
// When wallet credit will be applied, the sub-line shows the maths.
export function JoinBar({
  totalPence,
  walletPence = 0,
  state,
  gameId,
  loginHref,
}: {
  totalPence: number;
  // How much of the total the user's wallet will cover if they book now.
  walletPence?: number;
  state: JoinState;
  gameId: string;
  loginHref?: string;
}) {
  const cardPence = totalPence - walletPence;
  const joining = state === "join" || state === "waitlist";
  const subLine =
    joining && walletPence > 0
      ? cardPence === 0
        ? "covered by your wallet"
        : `− ${formatPence(walletPence)} wallet = ${formatPence(cardPence)} to pay`
      : "all in";

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div>
          <p className="font-heading text-2xl font-bold tabular-nums leading-none">
            {formatPence(totalPence)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {subLine}
          </p>
        </div>
        <JoinButton state={state} gameId={gameId} loginHref={loginHref} />
      </div>
    </div>
  );
}
