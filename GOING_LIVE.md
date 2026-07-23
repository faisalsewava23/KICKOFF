# GOING_LIVE.md — flipping KickOff to real payments

The app runs in **Stripe test mode** through the beta. Going live is config,
not code. Do these **in order**. Nothing here requires a deploy except where
marked.

## 0. Before you start

- [ ] Beta finished; you're happy with webhook + email health (see §7).
- [ ] You own a domain and it's attached to the Vercel project
      (Vercel → Project → Settings → Domains). Update `NEXT_PUBLIC_APP_URL`
      in Vercel env to `https://yourdomain.com` when it's live, and update
      Supabase Site URL + redirect allow-list to match. Redeploy.

## 1. Stripe live-mode platform setup

- [ ] Stripe Dashboard → toggle **test mode OFF** (top right).
- [ ] Complete your **platform account activation** (business details, bank
      account for collecting KickOff's application fees).
- [ ] **Connect settings** (live): dashboard.stripe.com/settings/connect —
      confirm Express accounts enabled, set the platform name ("KickOff"),
      icon, and support email that appear during organiser onboarding.

## 2. Live keys into Vercel

Vercel → Project → Settings → Environment Variables (Production):

- [ ] `STRIPE_SECRET_KEY` → live `sk_live_…` (Developers → API keys, live mode)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → live `pk_live_…`
- [ ] Leave everything Supabase/Resend/CRON unchanged.

Do **not** redeploy yet — do §3 first so the webhook secret ships in the
same deploy.

## 3. Live webhook endpoint

- [ ] Stripe (live mode) → Developers → Webhooks → **Add endpoint**:
      `https://<your-domain>/api/stripe/webhook`
- [ ] Events — exactly these three:
      `checkout.session.completed`, `payment_intent.succeeded`,
      `payment_intent.payment_failed`
- [ ] Copy its **signing secret** → Vercel env `STRIPE_WEBHOOK_SECRET`
      (replaces the test one).
- [ ] **Redeploy** (Deployments → ⋯ → Redeploy) so live keys + secret load.
- [ ] The old test-mode endpoint can stay (test mode is separate) — dev now
      uses `stripe listen` only.

## 4. Your cousin's real Express onboarding

Send him his organiser link (avatar menu → Become an organiser). He'll need
5–10 minutes and:

- [ ] Mobile number (SMS verification)
- [ ] Legal name, DOB, home address
- [ ] **Bank details** (sort code + account number) for weekly payouts
- [ ] Photo ID (passport/driving licence) — Stripe may ask during or shortly
      after onboarding
- [ ] Reassure him: it's Stripe's own form; KickOff never sees his bank or ID.

Check he shows **charges_enabled** afterwards: his `/organiser` page shows no
"Finish setting up payouts" banner.

## 5. The £1 smoke test (real money)

- [ ] Cousin creates a £1 game at a real venue, kickoff > 6h out.
- [ ] You book it with a **real card**. Expect: £1.04 charged, confirmation
      email, booking on /bookings.
- [ ] Stripe (live) → Payments: charge shows £1.00 transfer to his account,
      £0.04 application fee retained.
- [ ] Cancel the booking (> 6h before): wallet credited £1.04, cancellation
      email arrives. (Wallet refunds are internal credit — the £1.04 cash
      stays in Stripe; that's the designed model. If you want the smoke-test
      money truly returned, refund the charge manually in the Stripe
      dashboard afterwards and zero the wallet in Supabase.)
- [ ] Cousin cancels the game → confirms the organiser-cancel email fires.

## 6. Email: real domain sender

- [ ] Resend → Domains → Add `yourdomain.com` → add the DKIM/SPF DNS records
      it shows you at your DNS host → wait for **Verified**.
- [ ] Code change (the one-liner): `src/lib/emails/send.ts` →
      `EMAIL_FROM = "KickOff <hello@yourdomain.com>"` → commit, push
      (auto-deploys).
- [ ] Supabase auth emails: Authentication → Emails → SMTP settings → point
      at Resend SMTP (host `smtp.resend.com`, user `resend`, password = your
      API key) so magic links also come from your domain and escape
      Supabase's built-in rate limits (a handful/hour — not enough for 300
      players). Set sender name "KickOff".
- [ ] Login emails are 6-digit codes: the Magic Link template must show
      `{{ .Token }}` prominently (no confirmation URL needed).

## 7. Week-one monitoring

Daily, five minutes:

- [ ] **Stripe → Developers → Webhooks → your endpoint**: delivery success
      rate must stay 100%. Any failure = bookings not being written; Stripe
      retries for 3 days, but investigate same-day (Vercel → Logs).
- [ ] **Stripe → Payments**: watch for disputes/Radar flags on early real
      charges (new accounts get extra scrutiny).
- [ ] **Resend → Emails**: delivery + bounce rates; promoted-from-waitlist
      emails matter most — nobody should learn about a charge from their
      bank statement.
- [ ] **Vercel → Logs**: filter for `[promotion]` and `[email]` errors, and
      for the daily cron run (08:00 UTC) returning `{"sent":N}`.
- [ ] **Supabase → Table Editor → bookings**: sanity-check no rows stuck in
      status `promoting` (self-heals on next promotion; a persistent one
      means a Stripe error worth reading in the logs).

## Rollback

Any disaster: Vercel → Deployments → previous deployment → Promote to
Production. Payments config rolls back by restoring the test-mode env vars.
Money already moved lives in Stripe — nothing in a redeploy touches it.
