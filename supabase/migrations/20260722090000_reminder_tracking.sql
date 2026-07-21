-- KickOff — Stage 9: 24-hour reminder idempotency.
-- The reminder cron must never double-send: it stamps each booking when its
-- reminder goes out and skips stamped rows on re-runs.
alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;
