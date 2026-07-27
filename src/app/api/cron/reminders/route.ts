import { NextResponse } from "next/server";
import { sendReminderEmail } from "@/lib/emails/reminder";
import { appUrl, kickoffLabel } from "@/lib/emails/notify";
import { retryPendingWalletPayouts } from "@/lib/payouts";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Kickoff reminders + the daily money janitor. Runs daily at 08:00 UTC via
// Vercel Cron (hourly crons need a paid plan).
//
// Reminders: finds open games kicking off within the next 24 hours and
// emails their confirmed players — so everyone gets a morning-of or
// evening-before nudge. Idempotent via bookings.reminder_sent_at — re-runs
// and overlapping windows never double-send.
//
// Janitor (all idempotent, belt-and-braces behind the webhook):
// - wallet holds still 'held' long after their checkout expired → released
// - waitlist/promoting bookings on games that already kicked off → resolved
//   cancelled (hands back wallet debits, releases card authorisations)
// - organiser payouts stuck 'pending' → retried
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

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

  const janitor = await runMoneyJanitor(db);

  return NextResponse.json({ sent, window: { from, to }, janitor });
}

async function runMoneyJanitor(db: ReturnType<typeof createAdminClient>) {
  let holdsReleased = 0;
  let staleWaitlistResolved = 0;

  // Holds outlive their 30-minute checkout only if the expiry webhook was
  // missed. 45 minutes leaves the webhook a clear head start.
  const holdCutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const { data: staleHolds, error: holdsError } = await db
    .from("wallet_holds")
    .select("id")
    .eq("status", "held")
    .lt("created_at", holdCutoff);
  if (holdsError) {
    console.error("[cron janitor] holds query failed:", holdsError.message);
  }
  for (const hold of staleHolds ?? []) {
    const { data: released, error } = await db.rpc("release_wallet_hold", {
      p_hold_id: hold.id,
    });
    if (error) {
      console.error("[cron janitor] hold release failed:", error.message);
    } else if (released) {
      holdsReleased += 1;
    }
  }

  // A waitlist spot on a game that kicked off is worthless — resolve it so
  // wallet debits go home and card authorisations are let go. (Card auths
  // would expire on their own; wallet debits would not.)
  const kickoffCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: deadWaitlist, error: deadError } = await db
    .from("bookings")
    .select("id, stripe_payment_intent, game:games!inner(kickoff_at)")
    .in("status", ["waitlist", "promoting"])
    .lt("game.kickoff_at", kickoffCutoff);
  if (deadError) {
    console.error("[cron janitor] stale waitlist query failed:", deadError.message);
  }
  for (const booking of deadWaitlist ?? []) {
    const { data: applied, error } = await db.rpc("resolve_waitlist_booking", {
      p_booking_id: booking.id,
      p_outcome: "cancelled",
    });
    if (error) {
      console.error("[cron janitor] stale waitlist resolve failed:", error.message);
      continue;
    }
    if (!applied) continue;
    staleWaitlistResolved += 1;
    if (booking.stripe_payment_intent) {
      try {
        await getStripe().paymentIntents.cancel(booking.stripe_payment_intent);
      } catch {
        // Already captured/cancelled/expired — nothing to release.
      }
    }
  }

  const payoutsRetried = await retryPendingWalletPayouts();

  return { holdsReleased, staleWaitlistResolved, payoutsRetried };
}
