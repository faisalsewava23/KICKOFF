import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { BookingCard, type BookingWithGame } from "@/components/booking-card";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My bookings",
};

export default async function BookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("bookings")
    .select("*, game:games(*, venue:venues(*))")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[bookings] query failed:", error.message);
  }

  // A booking whose game is no longer visible (RLS hides non-open games we
  // don't organise) can't be rendered meaningfully — skip it for now.
  const bookings: BookingWithGame[] = (data ?? []).flatMap((b) =>
    b.game ? [{ ...b, game: b.game }] : []
  );

  // Server component rendered per request — reading the clock is intentional.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcoming = bookings
    .filter((b) => new Date(b.game.kickoff_at).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.game.kickoff_at).getTime() -
        new Date(b.game.kickoff_at).getTime()
    );
  const past = bookings
    .filter((b) => new Date(b.game.kickoff_at).getTime() <= now)
    .sort(
      (a, b) =>
        new Date(b.game.kickoff_at).getTime() -
        new Date(a.game.kickoff_at).getTime()
    );

  return (
    <section>
      <h1 className="text-xs font-semibold tracking-wider text-muted-foreground">
        MY BOOKINGS
      </h1>

      {bookings.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="Nothing booked"
          description="You haven't booked anything yet."
          className="py-24"
        />
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {upcoming.length > 0 ? (
            <div className="flex flex-col gap-3">
              {upcoming.map((booking) => (
                <BookingCard key={booking.id} booking={booking} isPast={false} />
              ))}
            </div>
          ) : null}
          {past.length > 0 ? (
            <div>
              <h2 className="font-heading text-xs font-semibold tracking-wider">
                PAST
              </h2>
              <div className="mt-2 flex flex-col gap-3">
                {past.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} isPast />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
