# KickOff — Design References

This document maps real production apps to KickOff screens. Every reference is in `/references/[app-name]/`. When building a screen, look at the referenced apps first, then adapt for KickOff.

## Visual language sources

**Strava + Nike Run Club** — the *feel*. Bold typography, energetic accent colour, dark-mode-first, generous whitespace, huge display numerals for stats, all-caps small labels for section headers.

Use these for:
- Type hierarchy (Space Grotesk for headings, Inter for body, tabular-nums for stats)
- The KickOff orange treatment (#FF4500 as the single bold accent)
- Bottom nav styling
- Empty state layouts

## Structural sources

**Airbnb** — the *listing detail pattern*. Photos at the top, essential info clear and scannable, sticky booking CTA at the bottom, "who else is going" pattern maps directly to game rosters.

Use for:
- `/games/[id]` — game detail page
- Roster display (avatar stack, "12 players confirmed")
- Sticky bottom booking bar with price + CTA
- The transparent price breakdown pattern

**Zocdoc** — the *slot booking flow*. Best-in-class at "pick a time slot, confirm details, done."

Use for:
- The date/time picker on `/organiser/new`
- The "select time" experience when browsing games
- Post-booking confirmation screen
- Slot-based visual grouping (day headers, time chips)

**Gametime** — the *event list pattern*. Purpose-built for "events happening at times and venues with prices". Best structural match for what KickOff's games list needs to do.

Use for:
- `/games` — games list layout
- Date column on the left, event details in the middle, price on the right
- Filtering + sorting patterns
- Dark theme feel

## Competitor reference

**Footy Addicts** — take screenshots of the actual app in `/references/footy-addicts/`.

Use as:
- The floor, not the ceiling. KickOff should beat every Footy Addicts screen for clarity, speed, and visual polish.
- Reference for what specific football booking data is actually shown (formats, PQE-equivalents, roster sizes, venue conventions).
- Note where Footy Addicts *does* something well (e.g. the dropout mechanic messaging) — those patterns are worth preserving conceptually.

## Screen-by-screen mapping

### `/login`
- **Primary references**: Strava login/onboarding, Nike Run Club welcome screen
- **Feel**: Dark, centred, huge logotype, one input, one bold primary button
- **Do not copy**: Airbnb's login (too many options)

### `/games` (browse list)
- **Primary references**: Gametime event list, SeatGeek browse
- **Feel**: Dark theme, cards with clear date/time/venue/price hierarchy, scroll-through fluidity
- **Adaptations**: Add spots-remaining badge, format tag (5-a-side / 7-a-side)

### `/games/[id]` (game detail)
- **Primary references**: Airbnb listing detail, Gametime event detail
- **Feel**: Venue info at top, big date/time, transparent price breakdown, roster stack, sticky bottom "Join game" or "Join waitlist" button
- **Adaptations**: Roster shown as avatar stack with "+3 more", show organiser prominently

### Booking / checkout flow
- **Primary references**: Zocdoc booking confirmation, Airbnb reservation review
- **Feel**: Everything summarised on one screen, single primary button to pay
- **Adaptations**: Show platform fee transparently ("£8 game + £0.52 booking fee")

### `/bookings` (my bookings)
- **Primary references**: Airbnb Trips, Zocdoc My Appointments
- **Feel**: Upcoming first, past below, each row is a card with venue, date, time, status
- **Adaptations**: Status badges (Confirmed, Waitlist #2, Cancelled)

### `/organiser` (dashboard)
- **Primary references**: Airbnb Hosting dashboard, Gametime seller view
- **Feel**: Revenue widget at top, list of games with roster count and money collected
- **Adaptations**: Weekly view, clear payout status

### `/organiser/new` (create game)
- **Primary references**: Zocdoc slot picker, Airbnb listing creation
- **Feel**: Progressive disclosure, one section at a time, big native date/time pickers
- **Adaptations**: Venue selector with "add new venue" option

## Design principles to enforce everywhere

1. **Mobile-first, always.** Every screen must be built at 375px width first, then scale up.
2. **One primary action per screen.** Never two competing CTAs.
3. **Numbers are heroes.** Prices, dates, spot counts get the biggest, boldest treatment (Space Grotesk 700, tabular-nums, `text-4xl` or larger).
4. **Whitespace is signal.** Cards have generous padding (`p-6`). Sections have real breathing room.
5. **Dark mode is default.** Everything designed for dark backgrounds first. Light mode is a courtesy, not the priority.
6. **Motion is subtle but present.** `active:scale-95 transition-all` on every tap surface. Page transitions use `animate-in fade-in duration-300`.
7. **One accent colour only.** KickOff orange (`hsl(16 100% 55%)`) is the only non-neutral colour. No secondary blue, purple, or green — successes and warnings use scale-value differentiation, not hue.
8. **Language matches the vibe.** "You're in — see you there." not "Booking confirmed." Confident, casual, football-native.

## What NOT to copy

- **Airbnb's information density** — too much info on their listing pages. KickOff needs less.
- **Zocdoc's insurance/provider flows** — irrelevant clutter.
- **Gametime's animations** — they're heavy. Keep KickOff snappy.
- **Footy Addicts' visual system in general** — it's dated. Take the *concepts* (roster, waitlist, dropout messaging), not the *look*.

## How to use this in Claude Code prompts

When starting a new session for a design-heavy stage:

> "Read PROJECT.md and DESIGN_REFERENCES.md. Look at the screens in /references/gametime/ and /references/airbnb/. Build the /games list following those references — Gametime's structural pattern, our KickOff dark+orange visual language. Match the type hierarchy from the Strava reference too."

Being specific about *which* reference for *which* aspect of *which* screen keeps Claude Code focused.
