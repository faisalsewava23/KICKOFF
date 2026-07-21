-- KickOff — RLS verification script (dev utility, NOT a migration).
-- Run in the Supabase SQL Editor AFTER the migration and seed. Everything is
-- wrapped in a transaction that rolls back, so the throwaway test users and
-- bookings leave no trace. Safe to run repeatedly.
--
-- Expected result: every SELECT row shows pass = true, and the two DO blocks
-- raise "PASS" notices.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (created as postgres, bypassing RLS; rolled back at the end)
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-test-a@kickoff.dev', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-test-b@kickoff.dev', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- User A books a seed game
insert into public.bookings (id, game_id, user_id, status)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
        '33333333-3333-3333-3333-333333333301',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        'confirmed')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Impersonate user A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1","role":"authenticated"}', true);

select 'A sees the 4 open seed games' as check, count(*) = 4 as pass
  from public.games;

select 'A sees exactly one profile (their own)' as check,
       count(*) = 1
       and bool_and(id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1') as pass
  from public.profiles;

select 'A sees their own booking' as check, count(*) = 1 as pass
  from public.bookings;

select 'A sees both venues' as check, count(*) = 2 as pass
  from public.venues;

select 'A sees no payouts' as check, count(*) = 0 as pass
  from public.organiser_payouts;

-- ---------------------------------------------------------------------------
-- Impersonate user B
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2","role":"authenticated"}', true);

select 'B sees no bookings (A''s booking is hidden)' as check, count(*) = 0 as pass
  from public.bookings;

select 'B sees exactly one profile (their own)' as check,
       count(*) = 1
       and bool_and(id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2') as pass
  from public.profiles;

with upd as (
  update public.profiles set name = 'hacked'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  returning 1
)
select 'B cannot update A''s profile (0 rows touched)' as check,
       count(*) = 0 as pass
  from upd;

do $$
begin
  insert into public.venues (name, address)
  values ('RLS should block this', 'nowhere');
  raise exception 'FAIL: non-organiser was able to insert a venue';
exception
  when insufficient_privilege then
    raise notice 'PASS: non-organiser blocked from inserting a venue';
end $$;

do $$
begin
  insert into public.games (organiser_id, venue_id, kickoff_at, price_pence, max_players, format)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
          '22222222-2222-2222-2222-222222222201',
          now() + interval '1 day', 800, 10, '5-a-side');
  raise exception 'FAIL: non-organiser was able to insert a game';
exception
  when insufficient_privilege then
    raise notice 'PASS: non-organiser blocked from inserting a game';
end $$;

-- ---------------------------------------------------------------------------
-- Impersonate the seed organiser
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select 'Organiser sees A''s booking on their game' as check, count(*) = 1 as pass
  from public.bookings
 where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

rollback;
