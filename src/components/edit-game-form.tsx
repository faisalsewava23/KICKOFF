"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Stepper } from "@/components/stepper";
import {
  updateGame,
  type UpdateGameState,
} from "@/app/(app)/organiser/games/[id]/actions";

const INITIAL: UpdateGameState = {};

export function EditGameForm({
  gameId,
  locked,
  confirmedCount,
  defaults,
}: {
  gameId: string;
  locked: boolean;
  confirmedCount: number;
  defaults: {
    date: string;
    time: string;
    duration: number;
    pricePounds: string;
    maxPlayers: number;
    description: string;
  };
}) {
  const [state, formAction, isPending] = useActionState(updateGame, INITIAL);
  const [maxPlayers, setMaxPlayers] = useState(defaults.maxPlayers);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.saved) toast("Saved.");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="game_id" value={gameId} />
      <input type="hidden" name="max_players" value={maxPlayers} />

      {locked ? (
        <p className="flex items-start gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Players have booked at this price and time, so those details are
          locked. You can still add spots below.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              name="date"
              required
              defaultValue={defaults.date}
              className="h-12"
            />
            <Input
              type="time"
              name="time"
              required
              defaultValue={defaults.time}
              className="h-12"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="edit-duration" className="text-sm text-muted-foreground">
              Duration (mins)
            </Label>
            <Input
              id="edit-duration"
              type="number"
              name="duration"
              defaultValue={defaults.duration}
              min={30}
              max={180}
              step={15}
              required
              className="h-12 w-24 tabular-nums"
            />
            <Label htmlFor="edit-price" className="ml-2 text-sm text-muted-foreground">
              Price (£)
            </Label>
            <Input
              id="edit-price"
              type="number"
              name="price_pounds"
              inputMode="decimal"
              step="0.50"
              min={1}
              max={50}
              required
              defaultValue={defaults.pricePounds}
              className="h-12 w-24 tabular-nums"
            />
          </div>
          <Textarea
            name="description"
            rows={2}
            maxLength={500}
            defaultValue={defaults.description}
            placeholder="Details (optional)"
          />
        </>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground">
            MAX PLAYERS
          </p>
          <Stepper
            value={maxPlayers}
            onChange={setMaxPlayers}
            min={locked ? Math.max(confirmedCount, defaults.maxPlayers) : 6}
            max={30}
            label="max players"
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="h-12 px-6 font-semibold active:scale-95 transition-all"
        >
          {isPending ? <Loader2 className="animate-spin" aria-hidden /> : "Save"}
        </Button>
      </div>
    </form>
  );
}
