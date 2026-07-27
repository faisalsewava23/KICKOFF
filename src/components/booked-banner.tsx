"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2 } from "lucide-react";

// Post-checkout success moment on the game page (?booked=1).
export function BookedBanner({
  variant,
  waitlistPosition,
  totalLabel,
  walletHeldLabel,
  cardChargeLabel,
}: {
  variant: "confirmed" | "waitlist";
  waitlistPosition: number | null;
  totalLabel: string;
  // Set when wallet credit is held against this waitlist spot — the
  // "you haven't been charged" line would be a lie without it.
  walletHeldLabel?: string | null;
  // The card remainder charged only at promotion (part-wallet waitlist).
  cardChargeLabel?: string | null;
}) {
  const waitlistNote = walletHeldLabel
    ? cardChargeLabel
      ? `${walletHeldLabel} is held from your wallet. If a spot opens, ${cardChargeLabel} goes on your card and you're confirmed. Leave the waitlist anytime before then — the credit goes straight back and your card is never charged.`
      : `${walletHeldLabel} is held from your KickOff wallet. If a spot opens you're automatically confirmed. Leave the waitlist anytime before then — the credit goes straight back.`
    : `You haven't been charged. If a spot opens, you'll be automatically charged ${totalLabel} and confirmed. Cancel your waitlist spot anytime before then — it's free.`;

  return (
    <div className="rounded-xl border border-primary/50 bg-primary/10 p-6 animate-in fade-in zoom-in-95 duration-300">
      <CircleCheck className="size-8 text-primary" aria-hidden />
      <p className="mt-3 font-heading text-2xl font-bold tracking-tight">
        {variant === "confirmed"
          ? "You're in — see you there."
          : `You're #${waitlistPosition ?? "—"} on the waitlist.`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {variant === "confirmed"
          ? "Your spot's locked in. Find it any time under Bookings."
          : waitlistNote}
      </p>
    </div>
  );
}

// Shown when the user returns from checkout before the webhook has written
// the booking. Re-renders the server page every 1.5s until it appears.
export function ConfirmingSpot() {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const poll = setInterval(() => router.refresh(), 1500);
    const slowTimer = setTimeout(() => setSlow(true), 15000);
    return () => {
      clearInterval(poll);
      clearTimeout(slowTimer);
    };
  }, [router]);

  return (
    <div className="flex items-center gap-3 rounded-xl border p-6">
      <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden />
      <div>
        <p className="font-heading font-semibold">Confirming your spot…</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {slow
            ? "Taking longer than usual — your payment went through, hang tight."
            : "Payment received. Locking it in."}
        </p>
      </div>
    </div>
  );
}
