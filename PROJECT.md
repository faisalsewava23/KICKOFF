# KickOff — Project Brief

## What we're building

**KickOff** — a mobile-first Progressive Web App that lets people find, book, and pay for casual football games. Think Footy Addicts, but simpler, cheaper for organisers, and built specifically to migrate an existing WhatsApp group of ~300 players onto the platform.

## Who this is for

- **Players**: people who want to play casual football without committing to a Sunday league. They browse games, pay online, and turn up.
- **Organisers**: people who already run football sessions (currently via WhatsApp) and want a better way to manage bookings, payments, and player lists.

## The immediate goal

Migrate an existing WhatsApp group of ~300 members onto the platform. First success metric: 50 active players booking games via KickOff within 8 weeks of launch.

## Differentiator vs Footy Addicts

- Cheaper for organisers: 4% platform fee vs Footy Addicts' 4.3% + 20p
- Better mobile UX — design language modelled on Strava, Nike Run Club, and modern booking apps (Airbnb, Zocdoc, Gametime)
- Migrates existing communities rather than trying to build a marketplace cold

## What we're NOT building (anti-scope)

The following are v2 features. Do not build them unless explicitly asked:

- In-app chat / messaging
- Player ratings, MOTM voting, or stats tracking
- Native iOS / Android apps (we are PWA-first)
- Push notifications (email only for MVP)
- Complex refund flows (single simple rule only — see below)
- Multi-currency, multi-language, multi-country support
- Social profiles beyond name + avatar
- Skill-level matching or filtering
- Leagues, tournaments, or recurring bookings
- Team creation, squads, friend groups
- Admin dashboards beyond the organiser's own view
- SMS reminders
- Any AI features
- Automated tests (add after we have real users)

If tempted to add these, stop. Add to `V2_IDEAS.md` and move on.

## Tech stack (do not deviate — ask before adding anything)

- **Framework**: Next.js 15 (App Router) with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui + `lucide-react` icons
- **Fonts**: Space Grotesk (headings) + Inter (body) via `next/font/google`
- **Database + Auth**: Supabase (Postgres, magic link auth, RLS enabled)
- **Payments**: Stripe (Stripe Connect Express for organiser payouts)
- **Email**: Resend for transactional email
- **Validation**: Zod
- **Dates**: date-fns
- **Hosting**: Vercel
- **Package manager**: pnpm

## Design direction

Bold and energetic. Reference points: Strava, Nike Run Club, Linear. High contrast, confident type, generous whitespace, dark mode by default, single bold accent colour.

See `DESIGN_REFERENCES.md` for the full visual brief and per-screen references.

### Colour system (HSL values for CSS variables in `src/app/globals.css`)

Dark mode (default):
- `--background`: `0 0% 4%`
- `--foreground`: `0 0% 98%`
- `--card`: `0 0% 7%`
- `--card-foreground`: `0 0% 98%`
- `--popover`: `0 0% 7%`
- `--popover-foreground`: `0 0% 98%`
- `--primary`: `16 100% 55%` (KickOff orange, ~#FF4500 family)
- `--primary-foreground`: `0 0% 100%`
- `--secondary`: `0 0% 12%`
- `--secondary-foreground`: `0 0% 98%`
- `--muted`: `0 0% 12%`
- `--muted-foreground`: `0 0% 65%`
- `--accent`: `0 0% 15%`
- `--accent-foreground`: `0 0% 98%`
- `--destructive`: `0 84% 60%`
- `--destructive-foreground`: `0 0% 98%`
- `--success`: `142 71% 45%`
- `--border`: `0 0% 15%`
- `--input`: `0 0% 15%`
- `--ring`: `16 100% 55%`

Light mode:
- `--background`: `0 0% 98%`
- `--foreground`: `0 0% 4%`
- `--primary`: `16 100% 50%`
- `--primary-foreground`: `0 0% 100%`
- `--muted`: `0 0% 96%`
- `--muted-foreground`: `0 0% 40%`
- `--border`: `0 0% 90%`
- `--ring`: `16 100% 50%`
- (mirror the rest of the palette appropriately)

Set `<html lang="en" className="dark">` in the root layout — dark is the default.

### Typography rules

- **Space Grotesk** → `--font-heading`, used on h1/h2/h3 and logotype. Tracking-tight, weight 600–700.
- **Inter** → `--font-sans`, used on body. Weight 400–500.
- **All-caps small labels** for section headers (e.g. "UPCOMING GAMES") in `text-xs font-semibold tracking-wider`.
- **Numbers, prices, times** should feel deliberate — use `tabular-nums` in Tailwind on all numeric text.

### Component rules

- **Buttons**: `h-14`, `text-base`, `font-semibold`, `rounded-lg`, `active:scale-95 transition-all` on every tap surface.
- **Cards**: substantial padding (`p-5` or `p-6`), `rounded-xl`, subtle border, `hover:border-primary/50 transition-colors`.
- **Empty states**: large icon (`size-16` muted), `text-3xl` headline in heading font, sub-line in muted-foreground.
- **Mobile-first, always.** Every screen must look right at 375px width.
- **Motion matters** — add `animate-in fade-in duration-300` to page transitions.

## Design principles to enforce everywhere

1. **Mobile-first, always.** Every screen must be built at 375px width first, then scale up.
2. **One primary action per screen.** Never two competing CTAs.
3. **Numbers are heroes.** Prices, dates, spot counts get the biggest, boldest treatment.
4. **Whitespace is signal.** Cards have generous padding. Sections have real breathing room.
5. **Dark mode is default.** Everything designed for dark backgrounds first.
6. **Motion is subtle but present.** `active:scale-95 transition-all` on every tap surface.
7. **One accent colour only.** KickOff orange is the only non-neutral colour.
8. **Language matches the vibe.** "You're in — see you there." not "Booking confirmed." Confident, casual, football-native.

## The 6 MVP features

Build them in this order. Ship after each one.

1. **Magic-link auth** — email in, magic link out, land on `/games`
2. **Browse games** — mobile list of upcoming games at `/games`. Shows venue, date/time, spots left, price. Click into game detail.
3. **Join a game** — Stripe checkout on the game detail page. On success, add booking record. If game is full, add to waitlist.
4. **Organiser: create game** — form at `/organiser/new` to create a game (venue, date, time, price, max players, format).
5. **Organiser: dashboard** — list at `/organiser` of the organiser's own games with roster + revenue collected.
6. **Waitlist auto-promotion** — if a player cancels, next waitlisted player is auto-charged and promoted to confirmed.

## Database schema (initial)

```sql
-- profiles extends auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  avatar_url text,
  stripe_customer_id text,
  stripe_connect_id text,
  wallet_balance_pence int not null default 0,
  is_organiser boolean not null default false,
  created_at timestamptz not null default now()
);

create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  postcode text,
  lat numeric,
  lng numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references profiles(id),
  venue_id uuid not null references venues(id),
  kickoff_at timestamptz not null,
  duration_mins int not null default 60,
  price_pence int not null,
  max_players int not null,
  format text not null, -- '5-a-side', '7-a-side', '11-a-side'
  description text,
  status text not null default 'open', -- open, cancelled, finished
  created_at timestamptz not null default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null references profiles(id),
  stripe_payment_intent text,
  status text not null default 'confirmed', -- confirmed, waitlist, cancelled
  waitlist_position int,
  created_at timestamptz not null default now(),
  unique(game_id, user_id)
);

create table organiser_payouts (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references profiles(id),
  game_id uuid not null references games(id),
  amount_pence int not null,
  stripe_transfer_id text,
  status text not null default 'pending', -- pending, paid, failed
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
```

Enable Row Level Security on every table. Policies:

- **profiles**: users can read/update only their own row.
- **venues**: anyone authenticated can read; only organisers can insert.
- **games**: anyone authenticated can read where `status='open'`; only the organiser can update/delete their own games.
- **bookings**: users see their own bookings; organisers see all bookings on their games.
- **organiser_payouts**: only visible to the organiser they belong to.

Generate TypeScript types from the schema into `src/types/database.ts`.

## Business rules

- **Platform fee**: 4% of every player payment. Added on top of what the organiser sets — the player sees the total, the organiser gets their price.
- **Cancellation policy**: full refund to wallet if cancelled more than 6 hours before kickoff. No refund after that.
- **Waitlist**: strict FIFO. When a spot opens, next player's saved payment method is auto-charged and they're promoted. If auto-charge fails, skip to the next player.
- **Payouts**: organisers receive their share weekly via Stripe Connect Express transfer.
- **Game cancellation by organiser**: all bookings auto-refunded to wallets.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`.env.local` must be in `.gitignore`. Never expose the service role key to the client.

## Folder structure

```
src/
  app/
    (auth)/
      login/page.tsx
    (app)/
      layout.tsx
      games/
        page.tsx
        [id]/page.tsx
      bookings/page.tsx
      organiser/
        page.tsx
        new/page.tsx
        games/[id]/page.tsx
    auth/callback/route.ts
    api/
      stripe/
        webhook/route.ts
        checkout/route.ts
    manifest.ts
    layout.tsx
    globals.css
  components/
    ui/                   -- shadcn primitives
    game-card.tsx
    join-button.tsx
    bottom-nav.tsx
    top-bar.tsx
    empty-state.tsx
    logotype.tsx
  lib/
    supabase/
      client.ts
      server.ts
      middleware.ts
    stripe.ts
    fees.ts               -- fee calculation helpers
    utils.ts
  types/
    database.ts
supabase/
  migrations/
references/               -- design reference screenshots
  airbnb/
  zocdoc/
  gametime/
  strava/
  nrc/
  footy-addicts/
```

## Success criteria for launch

Before we migrate the WhatsApp group, the app must:

- [ ] Support magic link login on mobile Safari and Chrome
- [ ] Show upcoming games with all details on one scrollable page
- [ ] Complete a Stripe payment for a game in under 60 seconds
- [ ] Send a confirmation email after booking
- [ ] Send a reminder email 24 hours before kickoff
- [ ] Automatically promote from waitlist on cancellation
- [ ] Allow the organiser to see their roster and revenue for a game
- [ ] Be installable to a phone home screen (PWA)
- [ ] Deploy to production on Vercel with a custom domain

## Working style with Claude Code

- One feature per branch. Ship to production after each merge.
- Every prompt should reference which of the 6 MVP features it relates to.
- Ask before installing new dependencies.
- Keep components under 150 lines. Split when they grow.
- Write server actions for mutations, not API routes, unless a webhook demands it.
- Use Supabase client on the server via `createServerClient`, never expose service role key to the client.
- No `any` types. Use the generated Supabase types.
- Mobile-first — after each stage, test on a 375px viewport before moving on.

## Out of scope reminders

If Claude Code suggests any of the following, push back:

- Building a native app (we're PWA-first)
- Adding a mobile app wrapper like Capacitor at this stage
- Building an admin panel
- Adding tests before shipping the MVP
- Using anything other than the stack above
- Building a complex UI library from scratch
- Any AI-powered features
