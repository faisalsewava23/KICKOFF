import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CancelGameButton } from "@/components/cancel-game-button";
import { EditGameForm } from "@/components/edit-game-form";
import { RosterList, type RosterRow } from "@/components/roster-list";
import { calculatePlayerTotal } from "@/lib/fees";
import { createClient } from "@/lib/supabase/server";
import { cn, formatPence } from "@/lib/utils";

export const metadata: Metadata = { title: "Your game" };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

export default async function OrganiserGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Forganiser");

  const { data: game } = await supabase
    .from("games")
    .select("*, venue:venues(name, address)")
    .eq("id", id)
    .maybeSingle();
  if (!game || game.organiser_id !== user.id) notFound();

  const [{ data: bookings }, { data: roster }] = await Promise.all([
    supabase
      .from("bookings")
      .select("status, waitlist_position, created_at")
      .eq("game_id", id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    supabase.rpc("game_roster", { p_game_id: id }),
  ]);

  // game_roster returns names in the same FIFO order as the bookings query
  // (both by created_at within each status) — zip them index-wise.
  const names = {
    confirmed: (roster ?? []).filter((r) => r.role === "confirmed"),
    waitlist: (roster ?? []).filter((r) => r.role === "waitlist"),
  };
  const confirmedRows: RosterRow[] = (bookings ?? [])
    .filter((b) => b.status === "confirmed")
    .map((b, i) => ({
      name: names.confirmed[i]?.display_name ?? "Player",
      bookedAt: b.created_at,
    }));
  const waitlistRows: RosterRow[] = (bookings ?? [])
    .filter((b) => b.status === "waitlist")
    .sort((a, b) => (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0))
    .map((b, i) => ({
      name: names.waitlist[i]?.display_name ?? "Player",
      bookedAt: b.created_at,
      waitlistPosition: b.waitlist_position,
    }));

  const confirmedCount = confirmedRows.length;
  const price = calculatePlayerTotal(game.price_pence);
  const earningsPence = confirmedCount * price.basePricePence;
  const feesPence = confirmedCount * price.feePence;
  const kickoff = new Date(game.kickoff_at);
  const isFull = confirmedCount >= game.max_players;
  const fillRatio = game.max_players > 0 ? confirmedCount / game.max_players : 0;

  return (
    <article className="flex flex-col gap-6">
      <Link
        href="/organiser"
        className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95 transition-all"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Your games
      </Link>

      <header>
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground">
            {format(kickoff, "EEEE d MMMM").toUpperCase()}
          </p>
          {game.status !== "open" ? (
            <Badge variant="outline" className="text-muted-foreground">
              {game.status}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 font-heading text-5xl font-bold tabular-nums tracking-tight">
          {format(kickoff, "HH:mm")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {game.venue?.name} · {game.format} · {formatPence(game.price_pence)}{" "}
          per player
        </p>
        <Link
          href={`/games/${game.id}`}
          className="mt-2 flex w-fit items-center gap-1.5 text-sm font-semibold text-primary active:scale-95 transition-all"
        >
          <ExternalLink className="size-4" aria-hidden />
          View as player
        </Link>
      </header>

      <div className="rounded-xl border bg-card p-5">
        <p className="font-heading text-3xl font-bold tabular-nums">
          {confirmedCount}
          <span className="text-lg text-muted-foreground">
            /{game.max_players}
          </span>{" "}
          <span className="text-lg">booked</span>
          {isFull && waitlistRows.length > 0 ? (
            <span className="ml-2 text-lg font-semibold text-primary">
              +{waitlistRows.length} waitlisted
            </span>
          ) : null}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full",
              fillRatio >= 0.8 ? "bg-primary" : "bg-muted-foreground"
            )}
            style={{ width: `${Math.min(fillRatio * 100, 100)}%` }}
          />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <SectionLabel>WHO&apos;S COMING</SectionLabel>
        <RosterList confirmed={confirmedRows} waitlist={waitlistRows} />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <SectionLabel>MONEY</SectionLabel>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Your earnings ({confirmedCount} × {formatPence(price.basePricePence)})
          </span>
          <span className="font-semibold tabular-nums">
            {formatPence(earningsPence)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">KickOff booking fees</span>
          <span className="tabular-nums text-muted-foreground">
            {formatPence(feesPence)}
          </span>
        </div>
      </section>

      {game.status === "open" ? (
        <>
          <Separator />
          <section className="flex flex-col gap-3">
            <SectionLabel>EDIT GAME</SectionLabel>
            <EditGameForm
              gameId={game.id}
              locked={(bookings ?? []).length > 0}
              confirmedCount={confirmedCount}
              defaults={{
                date: format(kickoff, "yyyy-MM-dd"),
                time: format(kickoff, "HH:mm"),
                duration: game.duration_mins,
                pricePounds: (game.price_pence / 100).toFixed(2),
                maxPlayers: game.max_players,
                description: game.description ?? "",
              }}
            />
          </section>
          <Separator />
          <CancelGameButton
            gameId={game.id}
            confirmedCount={confirmedCount}
            waitlistCount={waitlistRows.length}
          />
        </>
      ) : null}
    </article>
  );
}
