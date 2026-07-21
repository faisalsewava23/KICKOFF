import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startOfWeek } from "date-fns";
import { AlertTriangle, Trophy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import {
  OrganiserGameCard,
  type OrganiserGame,
} from "@/components/organiser-game-card";
import { RevenueSummary } from "@/components/revenue-summary";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your games",
};

export default async function OrganiserPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Forganiser");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organiser, stripe_connect_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_organiser) redirect("/organiser/onboarding");

  let chargesEnabled = true;
  if (profile.stripe_connect_id) {
    try {
      const account = await getStripe().accounts.retrieve(
        profile.stripe_connect_id
      );
      chargesEnabled = account.charges_enabled;
    } catch (err) {
      console.error("[organiser] account retrieve failed:", err);
    }
  }

  // Every figure below derives from these rows — no client-side maths.
  const [{ data: games }, { data: bookings }] = await Promise.all([
    supabase
      .from("games")
      .select("id, kickoff_at, price_pence, max_players, format, status, venue:venues(name)")
      .eq("organiser_id", user.id)
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("game_id, status, created_at")
      .neq("status", "cancelled"),
  ]);

  const gameList: OrganiserGame[] = games ?? [];
  const priceByGame = new Map(gameList.map((g) => [g.id, g.price_pence]));
  const confirmedByGame = new Map<string, number>();
  const waitlistByGame = new Map<string, number>();
  let weekPence = 0;
  let allTimePence = 0;
  let playersThisWeek = 0;
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();

  for (const b of bookings ?? []) {
    const price = priceByGame.get(b.game_id);
    if (price === undefined) continue; // not my game (RLS filters anyway)
    if (b.status === "confirmed") {
      confirmedByGame.set(b.game_id, (confirmedByGame.get(b.game_id) ?? 0) + 1);
      allTimePence += price;
      if (new Date(b.created_at).getTime() >= weekStart) {
        weekPence += price;
        playersThisWeek += 1;
      }
    } else if (b.status === "waitlist") {
      waitlistByGame.set(b.game_id, (waitlistByGame.get(b.game_id) ?? 0) + 1);
    }
  }

  // Server component rendered per request — reading the clock is intentional.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcoming = gameList.filter(
    (g) => new Date(g.kickoff_at).getTime() > now && g.status === "open"
  );
  const past = gameList
    .filter((g) => new Date(g.kickoff_at).getTime() <= now || g.status !== "open")
    .reverse();

  const card = (game: OrganiserGame, isPast: boolean) => (
    <OrganiserGameCard
      key={game.id}
      game={game}
      confirmed={confirmedByGame.get(game.id) ?? 0}
      waitlisted={waitlistByGame.get(game.id) ?? 0}
      isPast={isPast}
    />
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Your games
        </h1>
        <Link
          href="/organiser/new"
          className={cn(
            buttonVariants(),
            "h-10 px-4 font-semibold active:scale-95 transition-all"
          )}
        >
          Create game
        </Link>
      </div>

      {!chargesEnabled ? (
        <Link
          href="/organiser/onboarding/refresh"
          className="flex items-start gap-3 rounded-xl border border-primary/50 bg-primary/10 p-4 active:scale-95 transition-all"
        >
          <AlertTriangle className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="text-sm">
            <span className="font-semibold">Finish setting up payouts.</span>{" "}
            Stripe needs a bit more from you before players can pay for your
            games — tap to continue.
          </span>
        </Link>
      ) : null}

      <RevenueSummary
        weekPence={weekPence}
        allTimePence={allTimePence}
        playersThisWeek={playersThisWeek}
      />

      {gameList.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No games yet"
          description="Set up your first game — it takes about a minute."
          className="py-16"
        />
      ) : (
        <>
          {upcoming.length > 0 ? (
            <div>
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground">
                UPCOMING GAMES
              </h2>
              <div className="mt-2 flex flex-col gap-3">
                {upcoming.map((g) => card(g, false))}
              </div>
            </div>
          ) : null}
          {past.length > 0 ? (
            <div>
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground">
                PAST GAMES
              </h2>
              <div className="mt-2 flex flex-col gap-3">
                {past.map((g) => card(g, true))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
