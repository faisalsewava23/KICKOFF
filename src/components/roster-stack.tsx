import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

export type RosterPlayer = {
  display_name: string;
  avatar_url: string | null;
};

const MAX_VISIBLE = 6;

export function RosterStack({
  players,
  confirmedCount,
  maxPlayers,
  waitlistCount,
}: {
  // null → the viewer isn't allowed to see who's playing (logged out).
  players: RosterPlayer[] | null;
  confirmedCount: number;
  maxPlayers: number;
  waitlistCount: number;
}) {
  const visible = (players ?? []).slice(0, MAX_VISIBLE);
  const overflow = (players ?? []).length - visible.length;

  return (
    <div className="flex flex-col gap-3">
      {players === null ? (
        <p className="text-sm text-muted-foreground">
          Log in to see who&apos;s playing.
        </p>
      ) : players.length > 0 ? (
        <AvatarGroup>
          {visible.map((player, index) => (
            <Avatar key={index} className="size-10 ring-2 ring-background">
              {player.avatar_url ? (
                <AvatarImage src={player.avatar_url} alt={player.display_name} />
              ) : null}
              <AvatarFallback className="bg-secondary text-xs font-semibold">
                {initials(player.display_name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {overflow > 0 ? (
            <AvatarGroupCount className="size-10 text-xs">
              +{overflow}
            </AvatarGroupCount>
          ) : null}
        </AvatarGroup>
      ) : (
        <p className="text-sm text-muted-foreground">
          No one&apos;s in yet — be the first.
        </p>
      )}
      <p className="text-sm">
        <span className="font-semibold tabular-nums">
          {confirmedCount} of {maxPlayers}
        </span>{" "}
        <span className="text-muted-foreground">players confirmed</span>
        {waitlistCount > 0 ? (
          <span className="text-muted-foreground tabular-nums">
            {" "}
            · {waitlistCount} on waitlist
          </span>
        ) : null}
      </p>
    </div>
  );
}
