-- KickOff — Stage 7: atomic game cancellation.
--
-- Organiser cancels a game → every confirmed player's wallet is credited
-- with what they actually paid, every non-cancelled booking flips to
-- cancelled, and the game closes — all in ONE transaction. If anything
-- fails, nothing is applied. Called with the organiser's own session
-- (auth.uid() check inside); SECURITY DEFINER lets it credit other
-- players' wallets, which their RLS would otherwise forbid.
--
-- Waitlisted players are NOT wallet-credited: their card was only
-- authorised, never charged (the hold is released by the app after this
-- commits). Refund maths mirrors calculatePlayerTotal in src/lib/fees.ts:
-- fee = ceil(price × 4%), refund = price + fee.

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

  select count(*)::int into v_released
    from public.bookings
   where game_id = p_game_id and status = 'waitlist';

  update public.bookings
     set status = 'cancelled', waitlist_position = null
   where game_id = p_game_id and status <> 'cancelled';

  update public.games set status = 'cancelled' where id = p_game_id;

  return query select v_refunded, v_released;
end;
$$;

revoke all on function public.cancel_game_with_refunds(uuid) from public, anon;
grant execute on function public.cancel_game_with_refunds(uuid) to authenticated;
