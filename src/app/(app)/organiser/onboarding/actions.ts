"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

// Creates (or reuses) the Stripe Connect Express account for the current
// user and sends them into Stripe's hosted onboarding.
export async function startOnboarding(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/login?next=%2Forganiser%2Fonboarding");

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  let accountLinkUrl: string;
  try {
    const stripe = getStripe();

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_connect_id")
      .eq("id", user.id)
      .maybeSingle();

    let connectId = profile?.stripe_connect_id ?? null;
    if (!connectId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { user_id: user.id },
      });
      connectId = account.id;
      const { error: saveError } = await supabase
        .from("profiles")
        .update({ stripe_connect_id: connectId })
        .eq("id", user.id);
      if (saveError) {
        // Without the id persisted we'd orphan the Stripe account — bail.
        console.error(
          "[startOnboarding] failed to save connect id:",
          saveError.message
        );
        redirect("/organiser/onboarding?error=1");
      }
    }

    const link = await stripe.accountLinks.create({
      account: connectId,
      type: "account_onboarding",
      return_url: `${origin}/organiser/onboarding/complete`,
      refresh_url: `${origin}/organiser/onboarding/refresh`,
    });
    accountLinkUrl = link.url;
  } catch (err) {
    console.error("[startOnboarding] Stripe error:", err);
    redirect("/organiser/onboarding?error=1");
  }

  redirect(accountLinkUrl);
}
