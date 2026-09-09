-- Reminder bookkeeping, kept on the invite row itself.
--
-- A separate table was the obvious shape and the wrong one: the only
-- question ever asked is "has this invite been chased, and when", and
-- that belongs next to the invite. It also makes the cap impossible to
-- lose track of, because the counter and the thing being counted are
-- the same row.

alter table public.interviews
  add column if not exists reminder_count  integer     not null default 0,
  add column if not exists last_reminded_at timestamptz;

comment on column public.interviews.reminder_count is
  'Reminders sent for this invite row. Hard-capped at 2 in lib/reminders.js.';

-- Only invite rows are ever scanned, and only unfinished ones.
create index if not exists interviews_pending_invites_idx
  on public.interviews (invited_at)
  where speaker = 'invite' and status is distinct from 'completed';
