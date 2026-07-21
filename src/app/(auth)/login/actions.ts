"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

export type SendMagicLinkResult = { success: boolean; error?: string };

export type LoginFormState = {
  sentTo?: string;
  error?: string;
  // Echoed back on error so the reset form can repopulate the input.
  email?: string;
};

// useActionState-compatible wrapper: works via native form POST even before
// the page's JavaScript hydrates (progressive enhancement).
export async function loginFormAction(
  _prev: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const email = formData.get("email");
  const next = formData.get("next");
  if (typeof email !== "string") {
    return { error: "Enter a valid email address." };
  }
  const result = await sendMagicLink(
    email,
    typeof next === "string" ? next : null
  );
  return result.success
    ? { sentTo: email.trim().toLowerCase() }
    : {
        error: result.error ?? "Something went wrong. Please try again.",
        email,
      };
}

// Read back by /auth/callback — keep the names in sync.
const NEXT_COOKIE = "kickoff_auth_next";

const emailSchema = z.email();

export async function sendMagicLink(
  email: string,
  next?: string | null
): Promise<SendMagicLinkResult> {
  const parsed = emailSchema.safeParse(email.trim().toLowerCase());
  if (!parsed.success) {
    return { success: false, error: "Enter a valid email address." };
  }

  // Stash the post-login destination in a short-lived cookie. It can't ride
  // on emailRedirectTo: the token_hash email template appends its own query
  // string, which would mangle a URL that already has one.
  const safeNext = safeNextPath(next);
  const cookieStore = await cookies();
  if (safeNext) {
    cookieStore.set(NEXT_COOKIE, safeNext, {
      path: "/",
      maxAge: 60 * 10,
      httpOnly: true,
      sameSite: "lax",
    });
  } else {
    cookieStore.delete(NEXT_COOKIE);
  }

  // Use the origin the request came from (localhost or LAN IP) so the
  // magic link returns to the same host the user is browsing on.
  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    console.error(
      `[sendMagicLink] signInWithOtp failed (status ${error.status}):`,
      error.message
    );
    if (error.status === 429) {
      return {
        success: false,
        error: "Too many attempts — give it a few minutes and try again.",
      };
    }
    return {
      success: false,
      error: "Couldn't send the link. Please try again.",
    };
  }

  return { success: true };
}
