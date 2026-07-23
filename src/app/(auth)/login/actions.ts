"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

// Email OTP login. Codes instead of links: Outlook SafeLinks pre-visits
// (and burns) one-time links, and links opened in a different browser than
// the one that requested them can't complete the exchange. A typed code is
// immune to both.

export type LoginFormState = {
  sentTo?: string;
  error?: string;
  // Echoed back on error so the reset form can repopulate the input.
  email?: string;
};

export type ResendResult = { success: boolean; error?: string };

export type VerifyState = { error?: string };

const emailSchema = z.email();

async function requestCode(email: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const parsed = emailSchema.safeParse(email.trim().toLowerCase());
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true },
  });
  if (error) {
    console.error(
      `[login] signInWithOtp failed (status ${error.status}):`,
      error.message
    );
    if (error.status === 429) {
      return {
        ok: false,
        error: "Too many attempts — give it a few minutes and try again.",
      };
    }
    return { ok: false, error: "Couldn't send the code. Please try again." };
  }
  return { ok: true, email: parsed.data };
}

// State 1 submit. useActionState-compatible: works via native form POST even
// before the page's JavaScript hydrates.
export async function sendLoginCode(
  _prev: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const email = formData.get("email");
  if (typeof email !== "string") {
    return { error: "Enter a valid email address." };
  }
  const result = await requestCode(email);
  return result.ok
    ? { sentTo: result.email }
    : { error: result.error, email };
}

// "Resend code" from state 2.
export async function resendLoginCode(email: string): Promise<ResendResult> {
  const result = await requestCode(email);
  return result.ok ? { success: true } : { success: false, error: result.error };
}

// State 2 submit: verify the 6-digit code, upsert the profile, and send the
// player where they were headed. Redirects on success (never returns).
export async function verifyOtpCode(
  _prev: VerifyState,
  formData: FormData
): Promise<VerifyState> {
  const email = formData.get("email");
  const token = formData.get("token");
  const next = formData.get("next");
  if (typeof email !== "string" || typeof token !== "string") {
    return { error: "Something went wrong — start again." };
  }
  const code = token.replace(/\D/g, "");
  // Codes are 6 digits by config; accept up to 8 so an admin-generated or
  // differently-configured code can never lock anyone out.
  if (code.length < 6 || code.length > 8) {
    return { error: "That code should be 6 digits." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code,
    type: "email",
  });

  if (error || !data.user) {
    console.error(
      `[login] verifyOtp failed (status ${error?.status}, code ${error?.code}):`,
      error?.message
    );
    // Supabase reports both wrong and expired codes as `otp_expired`; the
    // message distinguishes where it can.
    if (error?.code === "otp_expired") {
      return {
        error:
          "That code didn't work — it may have expired. Check the digits or resend a fresh one.",
      };
    }
    if (error?.status === 429) {
      return {
        error: "Too many attempts — give it a few minutes and try again.",
      };
    }
    return { error: "That code doesn't match — check it and try again." };
  }

  // Belt and braces alongside the on_auth_user_created trigger: make sure a
  // profiles row exists and carries the login email. Errors go to the server
  // log, never to the user — a profile hiccup must not block login.
  if (data.user.email) {
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: data.user.id, email: data.user.email });
    if (profileError) {
      console.error(
        `[login] profiles upsert failed for user ${data.user.id}:`,
        profileError.message
      );
    }
  }

  redirect(
    safeNextPath(typeof next === "string" ? next : null) ?? "/games"
  );
}
