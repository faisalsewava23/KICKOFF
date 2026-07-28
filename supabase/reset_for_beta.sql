-- KickOff — pre-beta reset. Wipes disposable test data, keeps every real
-- account. Transactional: any error rolls the whole thing back.
--
-- What it does, in dependency order:
--   1. organiser_payouts, bookings, wallet_holds, games  → deleted entirely
--      (payouts and holds must go before games: their FKs to games have no
--      cascade; bookings would cascade with games but are deleted
--      explicitly for clarity)
--   2. venues → deleted EXCEPT ids listed in the keep-list below
--   3. the seed organiser profile (fixed UUID from seed.sql) → deleted
--      (already absent as of the pre-flight check — kept as a safe no-op)
--   4. wallet_balance_pence → 0 on every remaining profile
--   NEVER touched: any other profiles row (emails, is_organiser,
--   stripe_connect_id, stripe_customer_id), auth.users, migrations.

begin;

-- ---------------------------------------------------------------------
-- KEEP-LIST: venues confirmed REAL. Currently empty because the only
-- venue in the database is the test fixture "Wallet Test Pitch"
-- (5080d0e5-eaa4-4e58-a694-b5ec4c4bcb8f, "1 Test Lane"). To keep a
-- venue, uncomment and add its id:
-- ---------------------------------------------------------------------
create temp table _keep_venues (id uuid primary key) on commit drop;
-- insert into _keep_venues (id) values
--   ('00000000-0000-0000-0000-000000000000');

-- 1. Money/booking records (children before parents)
delete from public.organiser_payouts;
delete from public.bookings;
delete from public.wallet_holds;
delete from public.games;

-- 2. Venues not on the keep-list
delete from public.venues v
 where not exists (select 1 from _keep_venues k where k.id = v.id);

-- 3. Seed organiser profile ONLY (fixed UUID; no other profile matches)
delete from public.profiles
 where id = '11111111-1111-1111-1111-111111111111';

-- 4. Zero all wallets
update public.profiles set wallet_balance_pence = 0;

-- Safety net: if the profile table shrank beyond the seed row, something
-- is very wrong — abort everything.
do $$
declare
  v_profiles int;
begin
  select count(*) into v_profiles from public.profiles;
  if v_profiles < 4 then
    raise exception 'expected at least 4 real profiles to survive, found % — rolling back', v_profiles;
  end if;
end $$;

commit;

-- Post-reset check (runs after commit; this is what the editor displays):
select 'bookings' as t, count(*) from public.bookings
union all select 'organiser_payouts', count(*) from public.organiser_payouts
union all select 'wallet_holds', count(*) from public.wallet_holds
union all select 'games', count(*) from public.games
union all select 'venues', count(*) from public.venues
union all select 'profiles', count(*) from public.profiles
union all select 'profiles with wallet > 0', count(*) from public.profiles where wallet_balance_pence > 0;
