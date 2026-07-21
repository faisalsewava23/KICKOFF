import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, MapPin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookedBanner, ConfirmingSpot } from "@/components/booked-banner";
import { JoinBar, type JoinState } from "@/components/join-button";
import { PriceBreakdown } from "@/components/price-breakdown";
import { RosterStack } from "@/components/roster-stack";
import { calculatePlayerTotal } from "@/lib/fees";
import { createClient } from "@/lib/supabase/server";
import { formatPence, initials } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("kickoff_at, format, venue:venues(name)")
    .eq("id", id)
    .maybeSingle();
  if (!game) return { title: "Game" };
  return {
    title: `${format(new Date(game.kickoff_at), "EEEE")} ${game.format} at ${game.venue?.name ?? "KickOff"}`,
  };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

export default async function GameDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ booked?: string }>;
}) {
  const [{ id }, { booked }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, venue:venues(*)")
    .eq("id", id)
    .maybeSingle();

  if (!game || game.status !== "open") notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged in: full roster (names) + own booking. Logged out: aggregate
  // counts only — the roster RPC is authenticated-only by design.
  let confirmed: { display_name: string; avatar_url: string | null }[] | null =
    null;
  let organiser: { display_name: string } | undefined;
  let confirmedCount = 0;
  let waitlistCount = 0;
  let myBookingStatus: string | undefined;
  let myWaitlistPosition: number | null = null;

  if (user) {
    const [{ data: roster, error: rosterError }, { data: myBooking }] =
      await Promise.all([
        supabase.rpc("game_roster", { p_game_id: id }),
        supabase
          .from("bookings")
          .select("status, waitlist_position")
          .eq("game_id", id)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
    if (rosterError) {
      console.error("[game detail] game_roster failed:", rosterError.message);
    }
    organiser = (roster ?? []).find((r) => r.role === "organiser");
    confirmed = (roster ?? []).filter((r) => r.role === "confirmed");
    confirmedCount = confirmed.length;
    waitlistCount = (roster ?? []).filter((r) => r.role === "waitlist").length;
    myBookingStatus = myBooking?.status;
    myWaitlistPosition = myBooking?.waitlist_position ?? null;
  } else {
    const { data: countRows, error: countsError } = await supabase.rpc(
      "game_booking_counts",
      { game_ids: [id] }
    );
    if (countsError) {
      console.error(
        "[game detail] game_booking_counts failed:",
        countsError.message
      );
    }
    confirmedCount = countRows?.[0]?.confirmed_count ?? 0;
    waitlistCount = countRows?.[0]?.waitlist_count ?? 0;
  }

  const kickoff = new Date(game.kickoff_at);
  const spotsLeft = Math.max(game.max_players - confirmedCount, 0);
  const price = calculatePlayerTotal(game.price_pence);

  const joinState: JoinState =
    myBookingStatus === "confirmed"
      ? "confirmed"
      : myBookingStatus === "waitlist"
        ? "on_waitlist"
        : spotsLeft > 0
          ? "join"
          : "waitlist";

  const loginHref = user
    ? undefined
    : `/login?next=${encodeURIComponent(`/games/${id}`)}`;

  const directionsQuery = encodeURIComponent(
    [game.venue?.name, game.venue?.address, game.venue?.postcode]
      .filter(Boolean)
      .join(", ")
  );

  return (
    <article className="flex flex-col gap-6 pb-16">
      <Link
        href="/games"
        className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95 transition-all"
      >
        <ChevronLeft className="size-4" aria-hidden />
        All games
      </Link>

      {booked === "1" && user ? (
        myBookingStatus === "confirmed" || myBookingStatus === "waitlist" ? (
          <BookedBanner
            variant={myBookingStatus === "confirmed" ? "confirmed" : "waitlist"}
            waitlistPosition={myWaitlistPosition}
            totalLabel={formatPence(price.totalPence)}
          />
        ) : (
          <ConfirmingSpot />
        )
      ) : null}

      <header>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground">
          {format(kickoff, "EEEE d MMMM").toUpperCase()}
        </p>
        <p className="mt-1 font-heading text-5xl font-bold tabular-nums tracking-tight">
          {format(kickoff, "HH:mm")}
        </p>
        <div className="mt-3 flex gap-2">
          <Badge variant="secondary">{game.format}</Badge>
          <Badge variant="outline" className="tabular-nums">
            {game.duration_mins} mins
          </Badge>
        </div>
      </header>

      <Separator />

      <section className="flex flex-col gap-2">
        <SectionLabel>VENUE</SectionLabel>
        <p className="font-semibold">{game.venue?.name ?? "Venue TBC"}</p>
        <p className="text-sm text-muted-foreground">
          {[game.venue?.address, game.venue?.postcode].filter(Boolean).join(", ")}
        </p>
        {game.venue ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${directionsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-1.5 text-sm font-semibold text-primary active:scale-95 transition-all"
          >
            <MapPin className="size-4" aria-hidden />
            Get directions
          </a>
        ) : null}
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <SectionLabel>PRICE</SectionLabel>
        <PriceBreakdown price={price} />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <SectionLabel>WHO&apos;S PLAYING</SectionLabel>
        <RosterStack
          players={confirmed}
          confirmedCount={confirmedCount}
          maxPlayers={game.max_players}
          waitlistCount={waitlistCount}
        />
      </section>

      {organiser ? (
        <>
          <Separator />
          <section className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-secondary text-xs font-semibold">
                {initials(organiser.display_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{organiser.display_name}</p>
              <p className="text-xs text-muted-foreground">Organiser</p>
            </div>
          </section>
        </>
      ) : null}

      {game.description ? (
        <>
          <Separator />
          <section className="flex flex-col gap-2">
            <SectionLabel>DETAILS</SectionLabel>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {game.description}
            </p>
          </section>
        </>
      ) : null}

      {user && joinState === "waitlist" ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          This game is full. If a spot opens, you&apos;ll be automatically
          charged{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatPence(price.totalPence)}
          </span>{" "}
          and confirmed. Cancel your waitlist spot anytime before then —
          it&apos;s free.
        </p>
      ) : null}
      {user && joinState === "on_waitlist" ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          If a spot opens, you&apos;ll be automatically charged{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatPence(price.totalPence)}
          </span>{" "}
          and confirmed. Cancelling your waitlist spot is free until then.
        </p>
      ) : null}

      <JoinBar
        totalPence={price.totalPence}
        state={joinState}
        gameId={id}
        loginHref={loginHref}
      />
    </article>
  );
}
