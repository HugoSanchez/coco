begin;

-- Add excluded dates array to track canceled occurrences (for EXDATE in Google Calendar)
alter table public.booking_series
  add column if not exists excluded_dates text[] default '{}';

-- Add JSONB to track standalone Google Calendar events for rescheduled occurrences
-- Format: { "0": "google_event_id_1", "5": "google_event_id_2" } where key is occurrence_index
alter table public.booking_series
  add column if not exists standalone_event_ids jsonb default '{}'::jsonb;

-- Add column to bookings table to store standalone event ID for quick lookup
alter table public.bookings
  add column if not exists google_standalone_event_id text;

-- Index for quick lookups
create index if not exists bookings_google_standalone_event_id_idx
  on public.bookings(google_standalone_event_id);

commit;

