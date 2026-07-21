import type { Metadata } from "next";
import { format, isToday, isTomorrow } from "date-fns";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { GameCard, type GameWithVenue } from "@/components/game-card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Games",
};

function dayLabel(date: Date): string {
  if (isToday(date)) return "TODAY";
  if (isTomorrow(date)) return "TOMORROW";
  return format(date, "EEE d MMM").toUpperCase();
}

function groupByDay(games: GameWithVenue[]) {
  const groups: { label: string; games: GameWithVenue[] }[] = [];
  for (const game of games) {
    const label = dayLabel(new Date(game.kickoff_at));
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.games.push(game);
    } else {
      groups.push({ label, games: [game] });
    }
  }
  return groups;
}

export default async function GamesPage() {
  const supabase = await createClient();
const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser();

console.log("[games] User:", user);
console.log("[games] User error:", userError);
  const { data: games, error } = await supabase
    .from("games")
    .select("*, venue:venues(*)")
    .eq("status", "open")
    .gt("kickoff_at", new Date().toISOString())
    .order("kickoff_at", { ascending: true });

  if (error) {
    console.error("[games] query failed:", error.message);
  }

  const gameList: GameWithVenue[] = games ?? [];

  const counts = new Map<string, number>();
  if (gameList.length > 0) {
    const { data: countRows, error: countsError } = await supabase.rpc(
      "game_booking_counts",
      { game_ids: gameList.map((g) => g.id) }
    );
    if (countsError) {
      // Most likely the Stage 4 RPC migration hasn't been applied yet —
      // fall back to zero counts rather than breaking the list.
      console.error("[games] game_booking_counts failed:", countsError.message);
    }
    for (const row of countRows ?? []) {
      counts.set(row.game_id, row.confirmed_count);
    }
  }

  return (
    <section>
      <h1 className="text-xs font-semibold tracking-wider text-muted-foreground">
        UPCOMING GAMES
      </h1>

      {gameList.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No games yet"
          description="No games yet — check back soon."
          className="py-24"
        />
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {groupByDay(gameList).map((group) => (
            <div key={group.label}>
              <h2 className="font-heading text-xs font-semibold tracking-wider">
                {group.label}
              </h2>
              <div className="mt-2 flex flex-col gap-3">
                {group.games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    confirmedCount={counts.get(game.id) ?? 0}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
