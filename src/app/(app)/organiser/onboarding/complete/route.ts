import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Stripe sends the user here after Express onboarding. Verify with Stripe
// what actually happened — never trust the redirect alone.
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
    const account = await getStripe().accounts.retrieve(
      profile.stripe_connect_id
    );
    if (account.details_submitted) {
      // Flip the organiser bit with the service role — deliberate, audited
      // spot rather than letting users self-serve the flag.
      const { error } = await createAdminClient()
        .from("profiles")
        .update({ is_organiser: true })
        .eq("id", user.id);
      if (error) {
        console.error("[onboarding/complete] flag update failed:", error.message);
      }
      return NextResponse.redirect(`${origin}/organiser?onboarded=1`);
    }
  } catch (err) {
    console.error("[onboarding/complete] account retrieve failed:", err);
  }

  return NextResponse.redirect(`${origin}/organiser/onboarding?incomplete=1`);
}
