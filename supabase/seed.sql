-- KickOff — development seed data. Safe to re-run: every row has a fixed UUID
-- and upserts on conflict, and game kickoffs are computed relative to today,
-- so re-running refreshes them back into the upcoming week.
--
-- The seed organiser ('11111111-…') is a development-only account. It needs a
-- row in auth.users because profiles.id has a foreign key to it, but nobody
-- can log in as it (no password, no magic link ever sent). Do not seed in
-- production.

-- 1) Dev organiser: auth user (the on_auth_user_created trigger will create
--    the bare profile row), then upgrade the profile to organiser.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'organiser@kickoff.dev', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.profiles (id, email, name, is_organiser)
values (
  '11111111-1111-1111-1111-111111111111',
  'organiser@kickoff.dev',
  'Dev Organiser',
  true
)
on conflict (id) do update
  set name = excluded.name,
      is_organiser = true;

-- 2) Venues
insert into public.venues (id, name, address, postcode, lat, lng, notes) values
  (
    '22222222-2222-2222-2222-222222222201',
    'Powerleague Shoreditch',
    'Braithwaite Street, Shoreditch, London',
    'E1 6GJ',
    51.5233, -0.0728,
    '3G rooftop pitches, changing rooms on site, 5 min from Shoreditch High Street Overground.'
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    'Market Road Pitches',
    'Market Road, Islington, London',
    'N7 9PL',
    51.5461, -0.1204,
    'Floodlit caged astro courts, free street parking after 6:30pm, nearest tube Caledonian Road.'
  )
on conflict (id) do update
  set name = excluded.name,
      address = excluded.address,
      postcode = excluded.postcode,
      lat = excluded.lat,
      lng = excluded.lng,
      notes = excluded.notes;

-- 3) Games — four upcoming games across the next 7 days, London evening
--    kickoffs. `at time zone 'Europe/London'` converts wall-clock time to the
--    correct timestamptz regardless of the server's timezone.
insert into public.games (
  id, organiser_id, venue_id, kickoff_at, duration_mins,
  price_pence, max_players, format, description, status
) values
  (
    '33333333-3333-3333-3333-333333333301',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    ((current_date + 1) + time '19:00') at time zone 'Europe/London',
    60, 700, 10, '5-a-side',
    'Casual Tuesday 5s — all levels welcome, bibs provided. Turn up 10 minutes early.',
    'open'
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222202',
    ((current_date + 2) + time '18:30') at time zone 'Europe/London',
    60, 600, 10, '5-a-side',
    'After-work kickabout. Fast and friendly — first to arrive picks teams.',
    'open'
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    ((current_date + 4) + time '20:00') at time zone 'Europe/London',
    90, 1000, 14, '7-a-side',
    'Weekend 7s on the rooftop. Decent standard — bring both a dark and a light shirt.',
    'open'
  ),
  (
    '33333333-3333-3333-3333-333333333304',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222202',
    ((current_date + 6) + time '21:00') at time zone 'Europe/London',
    60, 850, 14, '7-a-side',
    'Late kick-off under the floodlights. Winner stays on if we get spare players.',
    'open'
  )
on conflict (id) do update
  set organiser_id = excluded.organiser_id,
      venue_id = excluded.venue_id,
      kickoff_at = excluded.kickoff_at,
      duration_mins = excluded.duration_mins,
      price_pence = excluded.price_pence,
      max_players = excluded.max_players,
      format = excluded.format,
      description = excluded.description,
      status = excluded.status;
