-- KickOff — wallet payout correctness fix (follow-up to wallet_spending).
--
-- Found during verification: a booking row is REUSED when a player cancels
-- and later rebooks the same game (unique(game_id, user_id)). The payout
-- table's one-row-per-booking rule can't tell those two paid "lives" apart:
-- the old settled row would block the organiser's transfer for the new
-- payment (organiser shorted), and any looser rule risks paying twice.
--
-- Fix: bookings carry a payment_generation counter, bumped every time a
-- cancelled row is paid for again. Payouts key on booking+generation
-- (payout_key), so each paid life settles exactly once — retries and
-- replays included.

alter table public.bookings
  add column payment_generation int not null default 0;

alter table public.organiser_payouts
  drop constraint organiser_payouts_booking_id_key;

alter table public.organiser_payouts
  add column payout_key text;

create unique index organiser_payouts_payout_key_idx
  on public.organiser_payouts (payout_key);

-- A payout row is a money-movement record; it must survive its booking.
alter table public.organiser_payouts
  drop constraint organiser_payouts_booking_id_fkey;
alter table public.organiser_payouts
  add constraint organiser_payouts_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete set null;

-- book_with_wallet: identical to the wallet_spending version except the
-- rebook branch bumps payment_generation (a fresh payment for an old row).
create or replace function public.book_with_wallet(
  p_game_id uuid,
  p_user_id uuid,
  p_amount int
)
returns table (booking_id uuid, status text, waitlist_position int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_total int;
  v_balance int;
  v_confirmed int;
  v_promoting int;
  v_existing public.bookings%rowtype;
  v_rebooking boolean := false;
  v_status text;
  v_position int;
  v_booking_id uuid;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found or v_game.status <> 'open' then
    raise exception 'game_not_open';
  end if;
  if v_game.kickoff_at <= now() then
    raise exception 'game_kicked_off';
  end if;

  -- Recompute the total server-side (mirrors calculatePlayerTotal): the
  -- caller's amount must be exactly the current price — never trusted.
  v_total := v_game.price_pence + ceil(v_game.price_pence * 4 / 100.0)::int;
  if p_amount <> v_total then
    raise exception 'amount_mismatch';
  end if;

  select wallet_balance_pence into v_balance
    from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile_not_found';
  end if;
  if v_balance < p_amount then
    raise exception 'insufficient_balance';
  end if;

  select * into v_existing
    from public.bookings
   where game_id = p_game_id and user_id = p_user_id;
  if found then
    if v_existing.status <> 'cancelled' then
      raise exception 'already_booked';
    end if;
    v_rebooking := true; -- FOUND gets clobbered below; remember it here
  end if;

  select
    count(*) filter (where b.status = 'confirmed'),
    count(*) filter (where b.status = 'promoting')
    into v_confirmed, v_promoting
  from public.bookings b where b.game_id = p_game_id;

  if v_confirmed + v_promoting < v_game.max_players then
    v_status := 'confirmed';
    v_position := null;
  else
    v_status := 'waitlist';
    select coalesce(max(b.waitlist_position), 0) + 1 into v_position
      from public.bookings b
     where b.game_id = p_game_id and b.status in ('waitlist', 'promoting');
  end if;

  update public.profiles
     set wallet_balance_pence = wallet_balance_pence - p_amount
   where id = p_user_id;

  if v_rebooking then
    update public.bookings
       set status = v_status,
           waitlist_position = v_position,
           wallet_applied_pence = p_amount,
           stripe_payment_intent = null,
           payment_generation = v_existing.payment_generation + 1
     where id = v_existing.id;
    v_booking_id := v_existing.id;
  else
    insert into public.bookings
      (game_id, user_id, status, waitlist_position, wallet_applied_pence)
    values (p_game_id, p_user_id, v_status, v_position, p_amount)
    returning id into v_booking_id;
  end if;

  return query select v_booking_id, v_status, v_position;
end;
$$;

revoke all on function public.book_with_wallet(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.book_with_wallet(uuid, uuid, int) to service_role;
