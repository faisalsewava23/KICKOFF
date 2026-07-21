"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendGameCancelledEmail } from "@/lib/emails/game-cancelled";
import { appUrl, kickoffLabel } from "@/lib/emails/notify";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatPence } from "@/lib/utils";

export type CancelGameResult = {
  success: boolean;
  refundedCount?: number;
  error?: string;
};

export type UpdateGameState = { error?: string; saved?: boolean };

// Organiser cancels a game. The wallet credits, booking cancellations and
// game status change happen atomically in the cancel_game_with_refunds
// database function; the Stripe authorisation releases for waitlisted
// players happen after commit (idempotent, safe to retry).
export async function cancelGame(gameId: string): Promise<CancelGameResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You need to be logged in." };

  // Snapshot who's affected BEFORE the atomic cancel wipes the statuses —
  // needed for the auth releases and the notification emails after commit.
  const { data: gameDetails } = await supabase
    .from("games")
    .select("kickoff_at, price_pence, venue:venues(name)")
    .eq("id", gameId)
    .maybeSingle();
  const { data: affected } = await supabase
    .from("bookings")
    .select("user_id, status, stripe_payment_intent")
    .eq("game_id", gameId)
    .neq("status", "cancelled");
  const waitlistPIs = (affected ?? []).filter(
    (b) => b.status === "waitlist" && b.stripe_payment_intent
  );

  const { data, error } = await supabase.rpc("cancel_game_with_refunds", {
    p_game_id: gameId,
  });
  if (error) {
    console.error("[cancelGame] atomic cancel failed:", error.message);
    const friendly = error.message.includes("not your game")
      ? "Game not found."
      : error.message.includes("not open")
        ? "This game is already cancelled."
        : "Couldn't cancel the game. Nothing has been changed — try again.";
    return { success: false, error: friendly };
  }

  for (const row of waitlistPIs) {
    if (!row.stripe_payment_intent) continue;
    try {
      await getStripe().paymentIntents.cancel(row.stripe_payment_intent);
    } catch (err) {
      console.error("[cancelGame] auth release failed:", err);
    }
  }

  // Tell everyone what happened to their money (fire-and-forget).
  if (gameDetails && (affected ?? []).length > 0) {
    const admin = createAdminClient();
    const refundLabel = formatPence(
      gameDetails.price_pence +
        Math.ceil((gameDetails.price_pence * 4) / 100)
    );
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, wallet_balance_pence")
      .in(
        "id",
        (affected ?? []).map((b) => b.user_id)
      );
    for (const b of affected ?? []) {
      const profile = profiles?.find((p) => p.id === b.user_id);
      if (!profile?.email) continue;
      await sendGameCancelledEmail({
        to: profile.email,
        venueName: gameDetails.venue?.name ?? "the venue",
        kickoffLabel: kickoffLabel(gameDetails.kickoff_at),
        refundedLabel: b.status === "confirmed" ? refundLabel : null,
        walletLabel:
          b.status === "confirmed"
            ? formatPence(profile.wallet_balance_pence)
            : null,
        browseUrl: appUrl("/games"),
      });
    }
  }

  revalidatePath("/games");
  revalidatePath(`/organiser/games/${gameId}`);
  revalidatePath("/organiser");

  return { success: true, refundedCount: data?.[0]?.refunded_players ?? 0 };
}

const editSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a kickoff time."),
  duration: z.coerce.number().int().min(30).max(180),
  price_pounds: z.coerce
    .number({ error: "Enter a price." })
    .min(1, "Minimum price is £1.")
    .max(50, "Maximum price is £50."),
  max_players: z.coerce.number().int().min(6).max(30),
  description: z.string().trim().max(500).optional(),
});

// Editing rules: free while nobody has a live booking; after that, locked
// except max_players, which may only grow (never below confirmed count).
export async function updateGame(
  _prev: UpdateGameState,
  formData: FormData
): Promise<UpdateGameState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be logged in." };

  const gameId = formData.get("game_id");
  if (typeof gameId !== "string") return { error: "Missing game." };

  const { data: game } = await supabase
    .from("games")
    .select("id, organiser_id, status, max_players")
    .eq("id", gameId)
    .maybeSingle();
  if (!game || game.organiser_id !== user.id) return { error: "Game not found." };
  if (game.status !== "open") return { error: "This game is cancelled." };

  const { count: liveBookings } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .neq("status", "cancelled");
  const { count: confirmedCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("status", "confirmed");

  const maxPlayers = z.coerce
    .number()
    .int()
    .min(6)
    .max(30)
    .safeParse(formData.get("max_players"));
  if (!maxPlayers.success) return { error: "Max players must be 6–30." };

  if ((liveBookings ?? 0) > 0) {
    // Locked: only a max_players increase is allowed.
    if (maxPlayers.data < game.max_players) {
      return { error: "Max players can only be increased once people have booked." };
    }
    if (maxPlayers.data < (confirmedCount ?? 0)) {
      return { error: "Max players can't go below the confirmed count." };
    }
    const { error } = await supabase
      .from("games")
      .update({ max_players: maxPlayers.data })
      .eq("id", gameId);
    if (error) return { error: "Couldn't save. Please try again." };
  } else {
    const parsed = editSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form." };
    }
    const kickoff = new Date(`${parsed.data.date}T${parsed.data.time}:00`);
    if (Number.isNaN(kickoff.getTime()) || kickoff.getTime() <= Date.now()) {
      return { error: "Kickoff needs to be in the future." };
    }
    const { error } = await supabase
      .from("games")
      .update({
        kickoff_at: kickoff.toISOString(),
        duration_mins: parsed.data.duration,
        price_pence: Math.round(parsed.data.price_pounds * 100),
        max_players: parsed.data.max_players,
        description: parsed.data.description || null,
      })
      .eq("id", gameId);
    if (error) return { error: "Couldn't save. Please try again." };
  }

  revalidatePath(`/organiser/games/${gameId}`);
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/games");
  revalidatePath("/organiser");
  return { saved: true };
}
