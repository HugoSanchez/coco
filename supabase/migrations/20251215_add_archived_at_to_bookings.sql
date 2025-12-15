-- Add archived_at to bookings to support soft deletion / hiding in UI
alter table public.bookings
  add column if not exists archived_at timestamptz null;

-- Index to keep user-scoped archived lookups fast
create index if not exists bookings_archived_at_idx
  on public.bookings (user_id, archived_at);
