begin;

-- Add Google master recurring event id to booking_series
alter table public.booking_series
  add column if not exists google_master_event_id text;

create index if not exists booking_series_google_master_event_id_idx
  on public.booking_series(google_master_event_id);

commit;


