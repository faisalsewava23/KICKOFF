"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type CreateGameState = { error?: string };

const FORMATS = ["5-a-side", "7-a-side", "11-a-side"] as const;

const schema = z.object({
  venue_id: z.string().min(1, "Pick a venue."),
  new_venue_name: z.string().trim().max(80).optional(),
  new_venue_address: z.string().trim().max(160).optional(),
  new_venue_postcode: z.string().trim().max(10).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a kickoff time."),
  duration: z.coerce.number().int().min(30).max(180),
  price_pounds: z.coerce
    .number({ error: "Enter a price." })
    .min(1, "Minimum price is £1.")
    .max(50, "Maximum price is £50."),
  max_players: z.coerce.number().int().min(6).max(30),
  format: z.enum(FORMATS),
  description: z.string().trim().max(500).optional(),
});

export async function createGame(
  _prev: CreateGameState,
  formData: FormData
): Promise<CreateGameState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be logged in." };

  // Server-side gate — the route hides the form, this enforces it.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organiser")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_organiser) {
    return { error: "Only organisers can create games." };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }
  const input = parsed.data;

  const kickoff = new Date(`${input.date}T${input.time}:00`);
  if (Number.isNaN(kickoff.getTime()) || kickoff.getTime() <= Date.now()) {
    return { error: "Kickoff needs to be in the future." };
  }

  let venueId = input.venue_id;
  if (venueId === "new") {
    if (!input.new_venue_name || input.new_venue_name.length < 2) {
      return { error: "Give the new venue a name." };
    }
    if (!input.new_venue_address || input.new_venue_address.length < 5) {
      return { error: "Give the new venue an address." };
    }
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .insert({
        name: input.new_venue_name,
        address: input.new_venue_address,
        postcode: input.new_venue_postcode || null,
      })
      .select("id")
      .single();
    if (venueError || !venue) {
      console.error("[createGame] venue insert failed:", venueError?.message);
      return { error: "Couldn't save the venue. Please try again." };
    }
    venueId = venue.id;
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      organiser_id: user.id,
      venue_id: venueId,
      kickoff_at: kickoff.toISOString(),
      duration_mins: input.duration,
      price_pence: Math.round(input.price_pounds * 100),
      max_players: input.max_players,
      format: input.format,
      description: input.description || null,
    })
    .select("id")
    .single();
  if (gameError || !game) {
    console.error("[createGame] game insert failed:", gameError?.message);
    return { error: "Couldn't create the game. Please try again." };
  }

  redirect(`/organiser/games/${game.id}`);
}
