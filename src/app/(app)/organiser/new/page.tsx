import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GameForm } from "@/components/game-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Create game",
};

export default async function NewGamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Forganiser%2Fnew");

  // Server-side gate, not just hidden UI.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organiser")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_organiser) redirect("/organiser/onboarding");

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address")
    .order("name");

  return (
    <section className="flex flex-col gap-5">
      <h1 className="font-heading text-3xl font-bold tracking-tight">
        Create a game
      </h1>
      <GameForm venues={venues ?? []} />
    </section>
  );
}
