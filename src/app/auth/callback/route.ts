import { NextResponse } from "next/server";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

// SAFETY NET ONLY. Login is code-based now (see /login) — this route exists
// so magic links still sitting in inboxes from the link era resolve
// gracefully instead of 404ing. Old-link failures land on /login with a
// nudge towards the code flow. Remove a few weeks after the OTP switch.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next")) ?? "/games";

  const supabase = await createClient();

  let user: User | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) user = data.user;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) user = data.user;
  }

  if (!user) {
    const retry = next !== "/games" ? `&next=${encodeURIComponent(next)}` : "";
    return NextResponse.redirect(`${origin}/login?error=auth_failed${retry}`);
  }

  if (user.email) {
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, email: user.email });
    if (profileError) {
      console.error(
        `[auth/callback] profiles upsert failed for user ${user.id}:`,
        profileError.message
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
