import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

export type RosterRow = {
  name: string;
  bookedAt: string;
  waitlistPosition?: number | null;
};

function Row({ row }: { row: RosterRow }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar className="size-9">
        <AvatarFallback className="bg-secondary text-xs font-semibold">
          {initials(row.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">
          Booked {format(new Date(row.bookedAt), "d MMM, HH:mm")}
        </p>
      </div>
      {row.waitlistPosition ? (
        <span className="font-heading text-sm font-bold text-muted-foreground tabular-nums">
          #{row.waitlistPosition}
        </span>
      ) : null}
    </li>
  );
}

export function RosterList({
  confirmed,
  waitlist,
}: {
  confirmed: RosterRow[];
  waitlist: RosterRow[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {confirmed.length === 0 && waitlist.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No one&apos;s booked yet.
        </p>
      ) : null}
      {confirmed.length > 0 ? (
        <ul className="divide-y divide-border/60">
          {confirmed.map((row, i) => (
            <Row key={`c${i}`} row={row} />
          ))}
        </ul>
      ) : null}
      {waitlist.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground">
            WAITLIST
          </h3>
          <ul className="divide-y divide-border/60">
            {waitlist.map((row, i) => (
              <Row key={`w${i}`} row={row} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
