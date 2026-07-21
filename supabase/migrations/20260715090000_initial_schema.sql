-- KickOff — Stage 3 initial schema
-- Tables, indexes, RLS policies, and the auth.users → profiles trigger.
-- Schema is the contract from PROJECT.md — five tables, no extras.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- profiles extends auth.users
create table public.profiles (
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

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  postcode text,
  lat numeric,
  lng numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references public.profiles(id),
  venue_id uuid not null references public.venues(id),
  kickoff_at timestamptz not null,
  duration_mins int not null default 60,
  price_pence int not null,
  max_players int not null,
  format text not null, -- '5-a-side', '7-a-side', '11-a-side'
  description text,
  status text not null default 'open', -- open, cancelled, finished
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  stripe_payment_intent text,
  status text not null default 'confirmed', -- confirmed, waitlist, cancelled
  waitlist_position int,
  created_at timestamptz not null default now(),
  unique(game_id, user_id)
);

create table public.organiser_payouts (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references public.profiles(id),
  game_id uuid not null references public.games(id),
  amount_pence int not null,
  stripe_transfer_id text,
  status text not null default 'pending', -- pending, paid, failed
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index games_kickoff_at_idx on public.games (kickoff_at);
create index games_status_idx on public.games (status);
create index bookings_game_id_idx on public.bookings (game_id);
create index bookings_user_id_idx on public.bookings (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.games enable row level security;
alter table public.bookings enable row level security;
alter table public.organiser_payouts enable row level security;

-- profiles: users can read/update only their own row.
-- Insert-own is included so the /auth/callback upsert works for users who
-- existed before the handle_new_user trigger was installed.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- venues: anyone authenticated can read; only organisers can insert.
create policy "venues_select_authenticated"
  on public.venues for select
  to authenticated
  using (true);

create policy "venues_insert_organisers"
  on public.venues for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_organiser
    )
  );

-- games: anyone authenticated can read open games (organisers can also read
-- their own regardless of status); only the organiser can insert/update/delete
-- their own games.
create policy "games_select_open_or_own"
  on public.games for select
  to authenticated
  using (status = 'open' or organiser_id = (select auth.uid()));

create policy "games_insert_own_organiser"
  on public.games for insert
  to authenticated
  with check (
    organiser_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_organiser
    )
  );

create policy "games_update_own"
  on public.games for update
  to authenticated
  using (organiser_id = (select auth.uid()))
  with check (organiser_id = (select auth.uid()));

create policy "games_delete_own"
  on public.games for delete
  to authenticated
  using (organiser_id = (select auth.uid()));

-- bookings: users see their own bookings; organisers see all bookings on
-- their games. Writes happen server-side (Stripe flow, Stages 5–6).
create policy "bookings_select_own_or_game_organiser"
  on public.bookings for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.games g
      where g.id = game_id and g.organiser_id = (select auth.uid())
    )
  );

-- organiser_payouts: only visible to the organiser they belong to.
create policy "payouts_select_own"
  on public.organiser_payouts for select
  to authenticated
  using (organiser_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Auto-create a profile row on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
