import { formatPence } from "@/lib/utils";

// Dashboard hero numbers. "Your earnings" = organiser's share only
// (price × confirmed bookings) — never the gross the player paid.
export function RevenueSummary({
  weekPence,
  allTimePence,
  playersThisWeek,
}: {
  weekPence: number;
  allTimePence: number;
  playersThisWeek: number;
}) {
  const stats = [
    { label: "THIS WEEK", value: formatPence(weekPence) },
    { label: "ALL TIME", value: formatPence(allTimePence) },
    { label: "PLAYERS THIS WEEK", value: String(playersThisWeek) },
  ];

  return (
    <section aria-label="Your earnings">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground">
        YOUR EARNINGS
      </h2>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {stats.map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="font-heading text-2xl font-bold tabular-nums tracking-tight">
              {value}
            </p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-muted-foreground">
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
