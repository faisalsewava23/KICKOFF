-- KickOff — browse-first auth: logged-out visitors can browse games.
--
-- Opens READ access for the anon role to exactly what the public games list
-- and detail pages need: open games, venues, and aggregate booking counts.
-- Profiles, individual booking rows, payouts, and the roster (player names)
-- stay authenticated-only.

create policy "games_select_open_anon"
  on public.games for select
  to anon
  using (status = 'open');

create policy "venues_select_anon"
  on public.venues for select
  to anon
  using (true);

-- Spots-remaining needs aggregate counts only — safe for anon.
grant execute on function public.game_booking_counts(uuid[]) to anon;

-- game_roster (player display names) deliberately stays authenticated-only.
