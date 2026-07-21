import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

// Set by sendMagicLink (login/actions.ts) — keep the names in sync.
const NEXT_COOKIE = "kickoff_auth_next";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Where to land after login: explicit param, else the cookie set when the
  // magic link was requested. Both validated as relative paths.
  const cookieStore = await cookies();
  const next =
    safeNextPath(searchParams.get("next")) ??
    safeNextPath(cookieStore.get(NEXT_COOKIE)?.value) ??
    "/games";

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
    // Keep the destination through a retry.
    const retry =
      next !== "/games" ? `&next=${encodeURIComponent(next)}` : "";
    return NextResponse.redirect(
      `${origin}/login?error=auth_failed${retry}`
    );
  }

  // Belt and braces alongside the on_auth_user_created trigger: make sure a
  // profiles row exists and carries the login email. Errors go to the server
  // log, never to the user — a profile hiccup must not block login.
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

  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.delete(NEXT_COOKIE);
  return response;
}
