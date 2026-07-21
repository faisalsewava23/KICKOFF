-- KickOff — Stage 8: waitlist auto-promotion primitives.
--
-- Design: promotion is two-phase because a Stripe charge can't run inside a
-- DB transaction. Phase 1 (claim_next_waitlist_promotion) atomically marks
-- the next-in-line booking as status='promoting' under a row lock on the
-- game — this is the persisted promotion state that makes crashes
-- self-healing and concurrent cancellations safe. Phase 2 (the app) attempts
-- the charge, then calls resolve_waitlist_booking with the outcome.
--
-- Serialisation: every claim and resolve takes SELECT ... FOR UPDATE on the
-- games row first, so two near-simultaneous cancellations queue behind each
-- other; each sees the true confirmed+promoting counts and claims a
-- different booking. 'promoting' rows count against capacity, so a spot
-- can never be handed to two players.
--
-- Both functions are SERVICE-ROLE ONLY: they are invoked by trusted server
-- code (cancellation actions, the Stripe webhook), never by browsers.

create or replace function public.claim_next_waitlist_promotion(p_game_id uuid)
returns table (
  booking_id uuid,
  user_id uuid,
  stripe_payment_intent text,
  claimed_position int,
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
    select b.id, b.user_id, b.stripe_payment_intent, b.waitlist_position
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
                        v_b.waitlist_position, false;
    return;
  end if;

  -- No free spot, but an in-flight promotion may have crashed mid-charge:
  -- hand it back so the caller can finish it (idempotently).
  select b.id, b.user_id, b.stripe_payment_intent, b.waitlist_position
    into v_b
    from public.bookings b
   where b.game_id = p_game_id and b.status = 'promoting'
   order by b.waitlist_position asc nulls last, b.created_at asc
   limit 1;
  if found then
    return query select v_b.id, v_b.user_id, v_b.stripe_payment_intent,
                        v_b.waitlist_position, true;
  end if;
  return;
end;
$$;

-- Finalises a waitlist/promoting booking to confirmed or cancelled and
-- shifts everyone behind up one place. Idempotent: a booking already
-- resolved returns false and changes nothing — safe for webhook replays.
-- Also used for waitlist self-cancellation (outcome 'cancelled').
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
         stripe_payment_intent = coalesce(p_new_payment_intent, stripe_payment_intent)
   where id = p_booking_id;

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

revoke all on function public.claim_next_waitlist_promotion(uuid) from public, anon, authenticated;
revoke all on function public.resolve_waitlist_booking(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_next_waitlist_promotion(uuid) to service_role;
grant execute on function public.resolve_waitlist_booking(uuid, text, text) to service_role;
