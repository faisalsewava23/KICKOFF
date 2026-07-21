import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn, formatPence } from "@/lib/utils";
import type { Tables } from "@/types/database";

export type OrganiserGame = Pick<
  Tables<"games">,
  "id" | "kickoff_at" | "price_pence" | "max_players" | "format" | "status"
> & { venue: { name: string } | null };

export function OrganiserGameCard({
  game,
  confirmed,
  waitlisted,
  isPast,
}: {
  game: OrganiserGame;
  confirmed: number;
  waitlisted: number;
  isPast: boolean;
}) {
  const kickoff = new Date(game.kickoff_at);
  const revenuePence = confirmed * game.price_pence;
  const fillRatio = game.max_players > 0 ? confirmed / game.max_players : 0;
  const isFull = confirmed >= game.max_players;
  const nearlyFull = !isFull && fillRatio >= 0.8;

  return (
    <Link
      href={`/organiser/games/${game.id}`}
      className={cn(
        "block rounded-xl border bg-card p-5 transition-all hover:border-primary/50 active:scale-95",
        isPast && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">
            {game.venue?.name ?? "Venue TBC"}
          </p>
          <p className="mt-0.5 font-heading text-xl font-bold tabular-nums tracking-tight">
            {format(kickoff, "EEE d MMM · HH:mm")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-heading text-xl font-bold tabular-nums">
            {formatPence(revenuePence)}
          </p>
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">
            {isPast ? "EARNED" : "SO FAR"}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-sm">
          <span
            className={cn(
              "tabular-nums",
              isFull || nearlyFull
                ? "font-semibold text-primary"
                : "text-muted-foreground"
            )}
          >
            {isFull
              ? `FULL${waitlisted > 0 ? ` + ${waitlisted} waitlisted` : ""}`
              : `${confirmed} of ${game.max_players} booked`}
          </span>
          {game.status !== "open" ? (
            <Badge variant="outline" className="text-muted-foreground">
              {game.status}
            </Badge>
          ) : null}
        </div>
        {!isPast ? (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isFull || nearlyFull ? "bg-primary" : "bg-muted-foreground"
              )}
              style={{ width: `${Math.min(fillRatio * 100, 100)}%` }}
            />
          </div>
        ) : null}
      </div>
    </Link>
  );
}
