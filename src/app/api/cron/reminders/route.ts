import { NextResponse } from "next/server";
import { sendReminderEmail } from "@/lib/emails/reminder";
import { appUrl, kickoffLabel } from "@/lib/emails/notify";
import { createAdminClient } from "@/lib/supabase/admin";

// 24-hour reminders. Designed for Vercel Cron (hourly): finds open games
// kicking off 24–25h from now and emails their confirmed players.
// Idempotent via bookings.reminder_sent_at — re-runs never double-send.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const from = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

  const { data: games, error } = await db
    .from("games")
    .select("id, kickoff_at, venue:venues(name, address, postcode)")
    .eq("status", "open")
    .gte("kickoff_at", from)
    .lt("kickoff_at", to);
  if (error) {
    console.error("[cron reminders] games query failed:", error.message);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let sent = 0;
  for (const game of games ?? []) {
    const { data: bookings, error: bookingsError } = await db
      .from("bookings")
      .select("id, user_id")
      .eq("game_id", game.id)
      .eq("status", "confirmed")
      .is("reminder_sent_at", null);
    if (bookingsError) {
      // Loud failure — a missing column or broken query must not read as
      // "nothing to send".
      console.error("[cron reminders] bookings query failed:", bookingsError.message);
      return NextResponse.json(
        { error: `bookings query failed: ${bookingsError.message}` },
        { status: 500 }
      );
    }
    if (!bookings?.length) continue;

    const confirmedCount = bookings.length;
    const { data: profiles } = await db
      .from("profiles")
      .select("id, email")
      .in(
        "id",
        bookings.map((b) => b.user_id)
      );

    const address = [game.venue?.address, game.venue?.postcode]
      .filter(Boolean)
      .join(", ");
    const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      [game.venue?.name, address].filter(Boolean).join(", ")
    )}`;

    for (const booking of bookings) {
      const email = profiles?.find((p) => p.id === booking.user_id)?.email;
      if (!email) continue;
      // Stamp FIRST so a crash mid-send can't double-email on the re-run;
      // a missed send costs one reminder, a double-send costs trust.
      const { error: stampError } = await db
        .from("bookings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", booking.id)
        .is("reminder_sent_at", null);
      if (stampError) continue;
      await sendReminderEmail({
        to: email,
        venueName: game.venue?.name ?? "the venue",
        venueAddress: address,
        kickoffLabel: kickoffLabel(game.kickoff_at),
        confirmedCount,
        directionsUrl,
        gameUrl: appUrl(`/games/${game.id}`),
      });
      sent += 1;
    }
  }

  return NextResponse.json({ sent, window: { from, to } });
}
