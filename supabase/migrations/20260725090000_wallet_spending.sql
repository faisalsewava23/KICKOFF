-- KickOff — wallet spending. Closes the money loop: refunds landed in
-- profiles.wallet_balance_pence but nothing could spend it. Now checkout
-- applies wallet credit automatically.
--
-- Money safety follows the Stage 8 discipline exactly:
-- - Every function that moves wallet money locks the rows it touches with
--   SELECT ... FOR UPDATE, so a balance can never be spent twice.
-- - Lock ORDER is games → profiles → bookings everywhere, matching the
--   promotion RPCs, so concurrent bookings/cancellations queue instead of
--   deadlocking.
-- - Part-payments debit the wallet up front into a wallet_holds row; the
--   Stripe webhook either consumes the hold (payment succeeded) or releases
--   it (checkout expired). Every transition is idempotent.
--
-- All new functions are SERVICE-ROLE ONLY: invoked by trusted server code,
-- never by browsers.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

-- How much of this booking was paid from wallet credit (the rest went
-- through Stripe). Drives refunds, display, and organiser settlement.
alter table public.bookings
  add column wallet_applied_pence int not null default 0
  check (wallet_applied_pence >= 0);

-- A hold is wallet money debited for a Stripe Checkout that hasn't finished
-- yet. held → consumed (payment succeeded) or released (expired/abandoned).
create table public.wallet_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  game_id uuid not null references public.games(id),
  checkout_session_id text,
  amount_pence int not null check (amount_pence > 0),
  status text not null default 'held', -- held, consumed, released
  created_at timestamptz not null default now()
);

create index wallet_holds_status_created_idx
  on public.wallet_holds (status, created_at);

-- Service-role only: RLS on, no policies. Browsers never see holds — the
-- user-visible truth is their wallet balance, which the hold already debited.
alter table public.wallet_holds enable row level security;

-- Wallet-covered organiser settlement lives in organiser_payouts (unused
-- until now). One payout per booking, so retries can never double-pay.
alter table public.organiser_payouts
  add column booking_id uuid references public.bookings(id),
  add constraint organiser_payouts_booking_id_key unique (booking_id);

-- ---------------------------------------------------------------------------
-- Full-wallet booking: debit + booking in ONE transaction
-- ---------------------------------------------------------------------------

-- The whole point: no debit without a booking, no booking without the
-- debit. Confirmed vs waitlist is decided under the same game lock the
-- promotion machinery uses, so 'promoting' rows count against capacity.
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
           stripe_payment_intent = null
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

-- ---------------------------------------------------------------------------
-- Part-payment holds
-- ---------------------------------------------------------------------------

create or replace function public.hold_wallet_for_checkout(
  p_user_id uuid,
  p_game_id uuid,
  p_amount int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance int;
  v_hold_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select wallet_balance_pence into v_balance
    from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile_not_found';
  end if;
  if v_balance < p_amount then
    raise exception 'insufficient_balance';
  end if;

  update public.profiles
     set wallet_balance_pence = wallet_balance_pence - p_amount
   where id = p_user_id;

  insert into public.wallet_holds (user_id, game_id, amount_pence)
  values (p_user_id, p_game_id, p_amount)
  returning id into v_hold_id;

  return v_hold_id;
end;
$$;

-- Checkout abandoned/expired → money straight back. Idempotent: a hold
-- that isn't 'held' any more is left alone.
create or replace function public.release_wallet_hold(p_hold_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.wallet_holds%rowtype;
begin
  select * into v_hold from public.wallet_holds where id = p_hold_id for update;
  if not found or v_hold.status <> 'held' then
    return false;
  end if;

  update public.wallet_holds set status = 'released' where id = p_hold_id;
  update public.profiles
     set wallet_balance_pence = wallet_balance_pence + v_hold.amount_pence
   where id = v_hold.user_id;
  return true;
end;
$$;

-- Payment succeeded → the hold becomes real spend. Returns the amount to
-- stamp on the booking, or null if the money genuinely isn't available.
-- Idempotent for webhook replays (consumed → same amount again). The
-- 'released' branch covers one nasty race: the janitor released the hold
-- because the webhook was very late, then the webhook arrived — the player
-- WAS charged the discounted amount, so we take the credit back if it's
-- still there.
create or replace function public.consume_wallet_hold(p_hold_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.wallet_holds%rowtype;
  v_balance int;
begin
  select * into v_hold from public.wallet_holds where id = p_hold_id for update;
  if not found then
    return null;
  end if;

  if v_hold.status = 'held' then
    update public.wallet_holds set status = 'consumed' where id = p_hold_id;
    return v_hold.amount_pence;
  end if;

  if v_hold.status = 'consumed' then
    return v_hold.amount_pence;
  end if;

  -- released: try to re-debit the refunded credit
  select wallet_balance_pence into v_balance
    from public.profiles where id = v_hold.user_id for update;
  if v_balance is null or v_balance < v_hold.amount_pence then
    return null;
  end if;
  update public.profiles
     set wallet_balance_pence = wallet_balance_pence - v_hold.amount_pence
   where id = v_hold.user_id;
  update public.wallet_holds set status = 'consumed' where id = p_hold_id;
  return v_hold.amount_pence;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wallet-aware waitlist resolution
-- ---------------------------------------------------------------------------

-- Same signature and behaviour as Stage 8, plus: a booking resolved to
-- 'cancelled' hands any wallet debit straight back (waitlist self-cancel,
-- promotion decline, failed-payment webhook — every cancel path funnels
-- through here). Confirmed outcomes keep the debit: that money is spent.
create or replace function public.resolve_waitlist_booking(
  p_booking_id uuid,
  p_outcome text,
  p_new_payment_intent text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
begin
  if p_outcome not in ('confirmed', 'cancelled') then
    raise exception 'invalid outcome %', p_outcome;
  end if;

  select * into v_b from public.bookings where id = p_booking_id;
  if not found then
    return false;
  end if;

  -- Lock the game first (same order as claim) to serialise with promotions.
  perform 1 from public.games where id = v_b.game_id for update;

  select * into v_b from public.bookings where id = p_booking_id for update;
  if v_b.status not in ('waitlist', 'promoting') then
    return false; -- already resolved: idempotent no-op
  end if;

  update public.bookings
     set status = p_outcome,
         waitlist_position = null,
         stripe_payment_intent = coalesce(p_new_payment_intent, stripe_payment_intent),
         wallet_applied_pence = case
           when p_outcome = 'cancelled' then 0
           else wallet_applied_pence
         end
   where id = p_booking_id;

  if p_outcome = 'cancelled' and v_b.wallet_applied_pence > 0 then
    update public.profiles
       set wallet_balance_pence = wallet_balance_pence + v_b.wallet_applied_pence
     where id = v_b.user_id;
  end if;

  if v_b.waitlist_position is not null then
    update public.bookings
       set waitlist_position = waitlist_position - 1
     where game_id = v_b.game_id
       and status in ('waitlist', 'promoting')
       and waitlist_position > v_b.waitlist_position;
  end if;

  return true;
end;
$$;

-- Claim now also reports how much wallet credit the booking already holds,
-- so the promotion engine knows what (if anything) is left to charge.
-- Return type changes → drop and recreate.
drop function if exists public.claim_next_waitlist_promotion(uuid);

create function public.claim_next_waitlist_promotion(p_game_id uuid)
returns table (
  booking_id uuid,
  user_id uuid,
  stripe_payment_intent text,
  claimed_position int,
  wallet_applied_pence int,
  resumed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_confirmed int;
  v_promoting int;
  v_b record;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found or v_game.status <> 'open' then
    return;
  end if;

  select
    count(*) filter (where b.status = 'confirmed'),
    count(*) filter (where b.status = 'promoting')
    into v_confirmed, v_promoting
  from public.bookings b where b.game_id = p_game_id;

  if v_confirmed + v_promoting < v_game.max_players then
    -- A spot is genuinely free: claim the front of the queue.
    select b.id, b.user_id, b.stripe_payment_intent, b.waitlist_position,
           b.wallet_applied_pence
      into v_b
      from public.bookings b
     where b.game_id = p_game_id and b.status = 'waitlist'
     order by b.waitlist_position asc nulls last, b.created_at asc
     limit 1
       for update;
    if not found then
      return; -- waitlist empty
    end if;
    update public.bookings set status = 'promoting' where id = v_b.id;
    return query select v_b.id, v_b.user_id, v_b.stripe_payment_intent,
                        v_b.waitlist_position, v_b.wallet_applied_pence, false;
    return;
  end if;

  -- No free spot, but an in-flight promotion may have crashed mid-charge:
  -- hand it back so the caller can finish it (idempotently).
  select b.id, b.user_id, b.stripe_payment_intent, b.waitlist_position,
         b.wallet_applied_pence
    into v_b
    from public.bookings b
   where b.game_id = p_game_id and b.status = 'promoting'
   order by b.waitlist_position asc nulls last, b.created_at asc
   limit 1;
  if found then
    return query select v_b.id, v_b.user_id, v_b.stripe_payment_intent,
                        v_b.waitlist_position, v_b.wallet_applied_pence, true;
  end if;
  return;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organiser cancel-game: waitlist wallet debits go back too
-- ---------------------------------------------------------------------------

-- Confirmed players are refunded what they paid (unchanged — wallet-paid
-- players paid the same total, so the same refund is exactly right).
-- NEW: waitlisted/promoting players who put down wallet credit get that
-- credit back — their card was only ever authorised, but wallet money
-- actually moved.
create or replace function public.cancel_game_with_refunds(p_game_id uuid)
returns table (refunded_players int, released_waitlist int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_refund_pence int;
  v_refunded int := 0;
  v_released int := 0;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.organiser_id is distinct from auth.uid() then
    raise exception 'not your game';
  end if;
  if v_game.status <> 'open' then
    raise exception 'game is not open';
  end if;

  v_refund_pence := v_game.price_pence + ceil(v_game.price_pence * 4 / 100.0)::int;

  update public.profiles p
     set wallet_balance_pence = p.wallet_balance_pence + v_refund_pence
    from public.bookings b
   where b.game_id = p_game_id
     and b.status = 'confirmed'
     and p.id = b.user_id;
  get diagnostics v_refunded = row_count;

  update public.profiles p
     set wallet_balance_pence = p.wallet_balance_pence + b.wallet_applied_pence
    from public.bookings b
   where b.game_id = p_game_id
     and b.status in ('waitlist', 'promoting')
     and b.wallet_applied_pence > 0
     and p.id = b.user_id;

  select count(*)::int into v_released
    from public.bookings
   where game_id = p_game_id and status in ('waitlist', 'promoting');

  update public.bookings
     set status = 'cancelled', waitlist_position = null, wallet_applied_pence = 0
   where game_id = p_game_id and status <> 'cancelled';

  update public.games set status = 'cancelled' where id = p_game_id;

  return query select v_refunded, v_released;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.book_with_wallet(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.hold_wallet_for_checkout(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.release_wallet_hold(uuid) from public, anon, authenticated;
revoke all on function public.consume_wallet_hold(uuid) from public, anon, authenticated;
revoke all on function public.claim_next_waitlist_promotion(uuid) from public, anon, authenticated;
revoke all on function public.resolve_waitlist_booking(uuid, text, text) from public, anon, authenticated;

grant execute on function public.book_with_wallet(uuid, uuid, int) to service_role;
grant execute on function public.hold_wallet_for_checkout(uuid, uuid, int) to service_role;
grant execute on function public.release_wallet_hold(uuid) to service_role;
grant execute on function public.consume_wallet_hold(uuid) to service_role;
grant execute on function public.claim_next_waitlist_promotion(uuid) to service_role;
grant execute on function public.resolve_waitlist_booking(uuid, text, text) to service_role;

revoke all on function public.cancel_game_with_refunds(uuid) from public, anon;
grant execute on function public.cancel_game_with_refunds(uuid) to authenticated;
