"use client";

import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

export type VenueOption = Pick<Tables<"venues">, "id" | "name" | "address">;

export function VenuePicker({
  venues,
  value,
  onChange,
}: {
  venues: VenueOption[];
  value: string; // venue id or "new"
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {venues.map((venue) => (
        <button
          key={venue.id}
          type="button"
          onClick={() => onChange(venue.id)}
          className={cn(
            "rounded-xl border bg-card p-4 text-left transition-all active:scale-95",
            value === venue.id
              ? "border-primary ring-1 ring-primary"
              : "hover:border-primary/50"
          )}
        >
          <p className="font-semibold">{venue.name}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {venue.address}
          </p>
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChange("new")}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-dashed p-4 text-left font-semibold transition-all active:scale-95",
          value === "new"
            ? "border-primary ring-1 ring-primary"
            : "text-muted-foreground hover:border-primary/50"
        )}
      >
        <Plus className="size-4" aria-hidden />
        Add new venue
      </button>

      {value === "new" ? (
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new_venue_name">Venue name</Label>
            <Input
              id="new_venue_name"
              name="new_venue_name"
              required
              placeholder="Hackney Marshes Pitch 3"
              className="h-12"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new_venue_address">Address</Label>
            <Input
              id="new_venue_address"
              name="new_venue_address"
              required
              placeholder="Homerton Road, London"
              className="h-12"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new_venue_postcode">Postcode (optional)</Label>
            <Input
              id="new_venue_postcode"
              name="new_venue_postcode"
              placeholder="E9 5PF"
              className="h-12"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
