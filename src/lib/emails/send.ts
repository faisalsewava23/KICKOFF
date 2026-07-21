// Email dispatch. Server-side only. Every send is fire-and-forget with
// error logging — an email failure must never break a booking, promotion,
// or refund.
import { Resend } from "resend";
import type { ReactElement } from "react";

// One-line switch to the production domain at deploy time.
export const EMAIL_FROM = "KickOff <onboarding@resend.dev>";

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${subject}" to ${to}`);
    return;
  }
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      react,
    });
    if (error) {
      console.error(`[email] send failed "${subject}" to ${to}:`, error);
    }
  } catch (err) {
    console.error(`[email] send threw "${subject}" to ${to}:`, err);
  }
}
