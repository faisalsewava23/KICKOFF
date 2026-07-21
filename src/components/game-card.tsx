import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { formatPence } from "@/lib/utils";
import type { Tables } from "@/types/database";

export type GameWithVenue = Tables<"games"> & {
  venue: Tables<"venues"> | null;
};

export function GameCard({
  game,
  confirmedCount,
}: {
  game: GameWithVenue;
  confirmedCount: number;
}) {
  const kickoff = new Date(game.kickoff_at);
  const spotsLeft = Math.max(game.max_players - confirmedCount, 0);
  const isFull = spotsLeft === 0;
  const isUrgent = !isFull && spotsLeft <= 3;

  return (
    <Link
      href={`/games/${game.id}`}
      className="flex items-center gap-4 rounded-xl border bg-card p-5 transition-all hover:border-primary/50 active:scale-95"
    >
      <div className="flex w-12 shrink-0 flex-col items-center">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {format(kickoff, "EEE")}
        </span>
        <span className="font-heading text-3xl font-bold tabular-nums leading-none">
          {format(kickoff, "d")}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold tabular-nums">{format(kickoff, "HH:mm")}</p>
        <p className="truncate text-sm text-muted-foreground">
          {game.venue?.name ?? "Venue TBC"}
        </p>
        <Badge variant="secondary" className="mt-1.5">
          {game.format}
        </Badge>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-heading text-xl font-bold tabular-nums">
          {formatPence(game.price_pence)}
        </span>
        {isFull ? (
          <Badge>FULL — waitlist</Badge>
        ) : (
          <span
            className={
              isUrgent
                ? "text-xs font-semibold text-primary"
                : "text-xs text-muted-foreground"
            }
          >
            {isUrgent ? `Only ${spotsLeft} left` : `${spotsLeft} spots left`}
          </span>
        )}
      </div>
    </Link>
  );
}
