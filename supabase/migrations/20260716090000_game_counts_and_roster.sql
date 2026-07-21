-- KickOff — Stage 4: read-side helpers for the browse UI.
--
-- RLS intentionally hides other users' bookings and profiles, but the games
-- list needs "spots left" (a count of everyone's confirmed bookings) and the
-- detail page needs a roster (other players' display names). These two
-- SECURITY DEFINER functions expose exactly those aggregates and nothing
-- more — no user ids, no emails, no booking rows.

-- Confirmed/waitlist counts for a set of games (games list + detail page).
create or replace function public.game_booking_counts(game_ids uuid[])
returns table (game_id uuid, confirmed_count int, waitlist_count int)
language sql
security definer
set search_path = ''
stable
as $$
  select
    b.game_id,
    count(*) filter (where b.status = 'confirmed')::int as confirmed_count,
    count(*) filter (where b.status = 'waitlist')::int as waitlist_count
  from public.bookings b
  where b.game_id = any(game_ids)
  group by b.game_id
$$;

-- Who's playing: the organiser plus confirmed/waitlisted players, exposing
-- only a display name (profile name, else the email's local part) and avatar.
create or replace function public.game_roster(p_game_id uuid)
returns table (role text, display_name text, avatar_url text)
language sql
security definer
set search_path = ''
stable
as $$
  select roster.role, roster.display_name, roster.avatar_url from (
    select
      'organiser'::text as role,
      coalesce(nullif(p.name, ''), initcap(split_part(p.email, '@', 1))) as display_name,
      p.avatar_url,
      0 as sort_order,
      g.created_at as joined_at
    from public.games g
    join public.profiles p on p.id = g.organiser_id
    where g.id = p_game_id

    union all

    select
      b.status as role,
      coalesce(nullif(p.name, ''), initcap(split_part(p.email, '@', 1))) as display_name,
      p.avatar_url,
      case b.status when 'confirmed' then 1 else 2 end as sort_order,
      b.created_at as joined_at
    from public.bookings b
    join public.profiles p on p.id = b.user_id
    where b.game_id = p_game_id
      and b.status in ('confirmed', 'waitlist')
  ) roster
  order by sort_order, joined_at
$$;

-- Callable by logged-in users only.
revoke execute on function public.game_booking_counts(uuid[]) from public, anon;
revoke execute on function public.game_roster(uuid) from public, anon;
grant execute on function public.game_booking_counts(uuid[]) to authenticated;
grant execute on function public.game_roster(uuid) to authenticated;
