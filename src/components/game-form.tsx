"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FeePreview } from "@/components/fee-preview";
import { Stepper } from "@/components/stepper";
import { VenuePicker, type VenueOption } from "@/components/venue-picker";
import { cn } from "@/lib/utils";
import {
  createGame,
  type CreateGameState,
} from "@/app/(app)/organiser/new/actions";

const FORMATS = [
  { value: "5-a-side", defaultMax: 10 },
  { value: "7-a-side", defaultMax: 14 },
  { value: "11-a-side", defaultMax: 22 },
] as const;

const INITIAL: CreateGameState = {};

export function GameForm({ venues }: { venues: VenueOption[] }) {
  const [state, formAction, isPending] = useActionState(createGame, INITIAL);
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "new");
  const [format, setFormat] = useState<string>("5-a-side");
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [maxTouched, setMaxTouched] = useState(false);
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  function pickFormat(value: string, defaultMax: number) {
    setFormat(value);
    if (!maxTouched) setMaxPlayers(defaultMax);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-7">
      <input type="hidden" name="venue_id" value={venueId} />
      <input type="hidden" name="format" value={format} />
      <input type="hidden" name="max_players" value={maxPlayers} />

      <section className="flex flex-col gap-2">
        <Label className="text-xs font-semibold tracking-wider text-muted-foreground">
          VENUE
        </Label>
        <VenuePicker venues={venues} value={venueId} onChange={setVenueId} />
      </section>

      <section className="flex flex-col gap-2">
        <Label className="text-xs font-semibold tracking-wider text-muted-foreground">
          WHEN
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" name="date" required min={today} className="h-12" />
          <Input type="time" name="time" required className="h-12" />
        </div>
        <div className="mt-1 flex items-center gap-3">
          <Label htmlFor="duration" className="text-sm text-muted-foreground">
            Duration (mins)
          </Label>
          <Input
            id="duration"
            type="number"
            name="duration"
            defaultValue={60}
            min={30}
            max={180}
            step={15}
            required
            className="h-12 w-24 tabular-nums"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Label className="text-xs font-semibold tracking-wider text-muted-foreground">
          FORMAT
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {FORMATS.map(({ value, defaultMax }) => (
            <button
              key={value}
              type="button"
              onClick={() => pickFormat(value, defaultMax)}
              className={cn(
                "h-12 rounded-lg border font-semibold transition-all active:scale-95",
                format === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:border-primary/50"
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Label className="text-xs font-semibold tracking-wider text-muted-foreground">
          MAX PLAYERS
        </Label>
        <Stepper
          value={maxPlayers}
          onChange={(v) => {
            setMaxTouched(true);
            setMaxPlayers(v);
          }}
          min={6}
          max={30}
          label="max players"
        />
      </section>

      <section className="flex flex-col gap-2">
        <Label
          htmlFor="price_pounds"
          className="text-xs font-semibold tracking-wider text-muted-foreground"
        >
          PRICE PER PLAYER (£)
        </Label>
        <Input
          id="price_pounds"
          name="price_pounds"
          type="number"
          inputMode="decimal"
          step="0.50"
          min={1}
          max={50}
          required
          placeholder="7.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="h-14 text-base tabular-nums"
        />
        <FeePreview pricePounds={price} />
      </section>

      <section className="flex flex-col gap-2">
        <Label
          htmlFor="description"
          className="text-xs font-semibold tracking-wider text-muted-foreground"
        >
          DETAILS (OPTIONAL)
        </Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          placeholder="Bibs provided. All levels welcome."
        />
      </section>

      <Button
        type="submit"
        disabled={isPending}
        className="h-14 w-full text-base font-semibold active:scale-95 transition-all"
      >
        {isPending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Creating…
          </>
        ) : (
          "Create game"
        )}
      </Button>
    </form>
  );
}
