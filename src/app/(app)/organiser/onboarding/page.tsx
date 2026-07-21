import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Banknote, CalendarPlus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { startOnboarding } from "./actions";

export const metadata: Metadata = {
  title: "Become an organiser",
};

const PERKS = [
  {
    icon: CalendarPlus,
    title: "Create games in under a minute",
    body: "Pick a venue, set a time and price — you're live.",
  },
  {
    icon: Zap,
    title: "Payments collected automatically",
    body: "Players pay when they book. No chasing, no transfers, no IOUs.",
  },
  {
    icon: Banknote,
    title: "Paid out weekly",
    body: "Your money lands in your bank account automatically via Stripe.",
  },
];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; incomplete?: string }>;
}) {
  const { error, incomplete } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Forganiser%2Fonboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organiser")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_organiser) redirect("/organiser");

  return (
    <section className="flex flex-col gap-8 py-4">
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Run your own games.
        </h1>
        <p className="mt-2 text-muted-foreground">
          You keep 100% of your game price. Players pay a small booking fee on
          top — that&apos;s how KickOff makes money, not from you.
        </p>
      </header>

      <ul className="flex flex-col gap-5">
        {PERKS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4">
            <Icon className="size-6 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      {incomplete ? (
        <p className="rounded-lg border border-primary/50 bg-primary/10 p-4 text-sm">
          You&apos;re nearly there — Stripe needs a little more information
          before you can take payments. Pick up where you left off below.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Couldn&apos;t start Stripe onboarding just now. Give it another go.
        </p>
      ) : null}

      <form action={startOnboarding}>
        <Button
          type="submit"
          className="h-14 w-full text-base font-semibold active:scale-95 transition-all"
        >
          {incomplete ? "Finish setting up" : "Set up payouts with Stripe"}
        </Button>
      </form>
      <p className="-mt-4 text-center text-xs text-muted-foreground">
        Takes about 2 minutes. Powered by Stripe — we never see your bank
        details.
      </p>
    </section>
  );
}
