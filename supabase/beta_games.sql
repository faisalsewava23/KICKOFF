-- KickOff — beta seed: 3 real London venues + 4 realistic games.
-- Run AFTER reset_for_beta.sql.
--
-- No explicit BEGIN/COMMIT: the Supabase SQL editor already executes a
-- pasted script inside a single transaction (an explicit wrapper can make
-- the editor reject the run) — atomicity comes for free.
--
-- Owner: the real connected organiser (f.sewava23@hotmail.com). The script
-- aborts if that profile isn't an organiser with a Stripe Connect account,
-- so games can never be created against a broken payout setup.
--
-- Kickoffs are computed relative to now() IN LONDON TIME, so the script
-- lands games on sensible evening slots whenever it's run:
--   Game 1  +2 days  19:30  7-a-side  £8.50  max 14  (flagship midweek)
--   Game 3  +3 days  18:30  5-a-side  £6.00  max 4   (small-sided — the
--                                     waitlist fills fast by design)
--   Game 2  +4 days  18:30  5-a-side  £7.00  max 10
--   Game 4  next Sunday 20:00  7-a-side  £9.00  max 14 (weekend slot)

do $$
declare
  -- Parameter: the organiser who owns every beta game.
  v_organiser uuid := 'cc6adc68-f9a5-4ec3-9e13-2f086616c9bc';

  v_shoreditch uuid;
  v_market     uuid;
  v_mileend    uuid;

  v_today    date := (now() at time zone 'Europe/London')::date;
  v_sunday   date;
  v_days_to_sunday int;
begin
  -- Safety: refuse to run against the wrong profile.
  perform 1 from public.profiles
    where id = v_organiser
      and is_organiser = true
      and stripe_connect_id is not null;
  if not found then
    raise exception 'organiser % missing, not an organiser, or has no Stripe Connect account — aborting', v_organiser;
  end if;

  -- Real venues, verified addresses.
  insert into public.venues (name, address, postcode)
    values ('Powerleague Shoreditch',
            'Braithwaite Street, off Bethnal Green Road, London', 'E1 6GJ')
    returning id into v_shoreditch;

  insert into public.venues (name, address, postcode)
    values ('Market Road Football Pitches',
            'Market Road, Islington, London', 'N7 9PL')
    returning id into v_market;

  insert into public.venues (name, address, postcode)
    values ('Mile End Park Leisure Centre',
            '190 Burdett Road, Mile End, London', 'E3 4HL')
    returning id into v_mileend;

  -- Next Sunday evening (never today: if run on a Sunday, use the following
  -- one so the kickoff can't land in the past).
  v_days_to_sunday := (7 - extract(isodow from v_today)::int) % 7;
  if v_days_to_sunday = 0 then
    v_days_to_sunday := 7;
  end if;
  v_sunday := v_today + v_days_to_sunday;

  insert into public.games
    (organiser_id, venue_id, kickoff_at, duration_mins, price_pence,
     max_players, format, description, status)
  values
    (v_organiser, v_mileend,
     ((v_today + 2 + time '19:30')::timestamp) at time zone 'Europe/London',
     60, 850, 14, '7-a-side',
     'The midweek regular — good-standard 7s on 3G. Bibs and match balls sorted, just bring shin pads and water. Kick-off sharp at half seven.',
     'open'),

    (v_organiser, v_shoreditch,
     ((v_today + 3 + time '18:30')::timestamp) at time zone 'Europe/London',
     60, 600, 4, '5-a-side',
     'Quick after-work kickabout — small sides, first come, first served.',
     'open'),

    (v_organiser, v_market,
     ((v_today + 4 + time '18:30')::timestamp) at time zone 'Europe/London',
     60, 700, 10, '5-a-side',
     'Evening 5s under the floodlights. All levels welcome — teams get mixed on the night so it stays competitive.',
     'open'),

    (v_organiser, v_shoreditch,
     ((v_sunday + time '20:00')::timestamp) at time zone 'Europe/London',
     90, 900, 14, '7-a-side',
     'Sunday-night 7s to finish the weekend right. Full 3G pitch, proper match, winners stay on.',
     'open');
end $$;

-- Sanity summary — should read like a real games list.
select
  g.format,
  v.name as venue,
  to_char(g.kickoff_at at time zone 'Europe/London', 'Dy DD Mon HH24:MI') as kickoff_london,
  g.duration_mins || ' mins' as duration,
  '£' || to_char(g.price_pence / 100.0, 'FM990.00') as price,
  g.max_players,
  g.status
from public.games g
join public.venues v on v.id = g.venue_id
order by g.kickoff_at;
