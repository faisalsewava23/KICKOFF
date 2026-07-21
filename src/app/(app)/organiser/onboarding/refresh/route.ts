import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

// Account links are single-use and expire — Stripe redirects here when the
// user needs a fresh one mid-onboarding.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      `${origin}/login?next=%2Forganiser%2Fonboarding`
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.stripe_connect_id) {
    return NextResponse.redirect(`${origin}/organiser/onboarding`);
  }

  try {
    const link = await getStripe().accountLinks.create({
      account: profile.stripe_connect_id,
      type: "account_onboarding",
      return_url: `${origin}/organiser/onboarding/complete`,
      refresh_url: `${origin}/organiser/onboarding/refresh`,
    });
    return NextResponse.redirect(link.url);
  } catch (err) {
    console.error("[onboarding/refresh] link creation failed:", err);
    return NextResponse.redirect(`${origin}/organiser/onboarding?error=1`);
  }
}
