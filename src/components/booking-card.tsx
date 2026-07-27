import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { CancelBookingButton } from "@/components/cancel-booking-button";
import { calculatePlayerTotal } from "@/lib/fees";
import { formatPence } from "@/lib/utils";
import type { Tables } from "@/types/database";

export type BookingWithGame = Tables<"bookings"> & {
  game: Tables<"games"> & { venue: Tables<"venues"> | null };
};

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function StatusBadge({ booking }: { booking: BookingWithGame }) {
  if (booking.status === "confirmed") {
    return <Badge variant="secondary">Confirmed</Badge>;
  }
  if (booking.status === "waitlist") {
    return (
      <Badge variant="outline" className="tabular-nums">
        Waitlist{booking.waitlist_position ? ` #${booking.waitlist_position}` : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Cancelled
    </Badge>
  );
}

// "£8.32 paid", with the wallet/card split spelled out when credit was used.
function paidLabel(totalPence: number, walletPence: number): string {
  const total = formatPence(totalPence);
  if (walletPence <= 0) return `${total} paid`;
  if (walletPence >= totalPence) return `${total} paid from wallet`;
  return `${total} paid (${formatPence(walletPence)} wallet + ${formatPence(totalPence - walletPence)} card)`;
}

export function BookingCard({
  booking,
  isPast,
}: {
  booking: BookingWithGame;
  isPast: boolean;
}) {
  const kickoff = new Date(booking.game.kickoff_at);
  // Waitlist spots stay cancellable even after kickoff — wallet credit or a
  // card authorisation put down at join always needs a way back out.
  const cancellable =
    booking.status === "waitlist" ||
    (booking.status === "confirmed" && !isPast);
  // Server component rendered per request — reading the clock is intentional;
  // the server action re-checks the 6-hour rule at cancel time regardless.
  // eslint-disable-next-line react-hooks/purity
  const msToKickoff = kickoff.getTime() - Date.now();
  const refundable =
    booking.status === "confirmed" && msToKickoff > SIX_HOURS_MS;
  const price = calculatePlayerTotal(booking.game.price_pence);
  const walletHeld = booking.wallet_applied_pence;

  return (
    <div className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between gap-4">
        <Link
          href={`/games/${booking.game.id}`}
          className="min-w-0 flex-1 active:scale-95 transition-all"
        >
          <p className="truncate text-sm text-muted-foreground">
            {booking.game.venue?.name ?? "Venue TBC"}
          </p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums tracking-tight">
            {format(kickoff, "EEE d MMM · HH:mm")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {booking.game.format} ·{" "}
            {booking.status === "waitlist"
              ? formatPence(price.totalPence)
              : paidLabel(price.totalPence, walletHeld)}
          </p>
        </Link>
        <StatusBadge booking={booking} />
      </div>
      {booking.status === "waitlist" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {walletHeld <= 0 ? (
            <>
              Auto-charged{" "}
              <span className="tabular-nums">{formatPence(price.totalPence)}</span>{" "}
              if a spot opens — cancelling is free until then.
            </>
          ) : walletHeld >= price.totalPence ? (
            <>
              <span className="tabular-nums">{formatPence(walletHeld)}</span>{" "}
              held from your wallet — goes straight back if you leave.
              You&apos;re auto-confirmed if a spot opens.
            </>
          ) : (
            <>
              <span className="tabular-nums">{formatPence(walletHeld)}</span>{" "}
              wallet held +{" "}
              <span className="tabular-nums">
                {formatPence(price.totalPence - walletHeld)}
              </span>{" "}
              on your card if a spot opens — leaving before then refunds the
              credit.
            </>
          )}
        </p>
      ) : null}
      {cancellable ? (
        <div className="mt-3 flex justify-end">
          <CancelBookingButton
            bookingId={booking.id}
            refundable={refundable}
            refundPence={price.totalPence}
            isWaitlist={booking.status === "waitlist"}
            walletHeldPence={booking.status === "waitlist" ? walletHeld : 0}
          />
        </div>
      ) : null}
    </div>
  );
}
