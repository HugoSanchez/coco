begin;

-- Ensure required extension for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Master table for recurring booking series
create table if not exists public.booking_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  timezone text not null,
  -- Anchor local datetime for the first occurrence (wall time, no TZ), paired with timezone
  dtstart_local timestamp without time zone not null,
  duration_min integer not null check (duration_min > 0),
  -- v1 recurrence: weekly with interval 1 (weekly) or 2 (bi-weekly)
  recurrence_kind text not null check (recurrence_kind in ('WEEKLY')),
  interval_weeks integer not null default 1 check (interval_weeks in (1, 2)),
  -- 0=Sunday .. 6=Saturday (align with JS getDay semantics). Use your UI mapping accordingly
  by_weekday integer not null check (by_weekday between 0 and 6),
  -- booking metadata
  mode text,
  location_text text,
  consultation_type text,
  status text not null default 'active', -- 'active' | 'paused' | 'ended'
  -- Optional end for the series (wall time). Null means open-ended
  until timestamp without time zone,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_series_user_id_idx on public.booking_series(user_id);
create index if not exists booking_series_status_idx on public.booking_series(status);

-- RLS
alter table public.booking_series enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'booking_series' and policyname = 'Allow read own series'
  ) then
    create policy "Allow read own series" on public.booking_series for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'booking_series' and policyname = 'Allow insert own series'
  ) then
    create policy "Allow insert own series" on public.booking_series for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'booking_series' and policyname = 'Allow update own series'
  ) then
    create policy "Allow update own series" on public.booking_series for update
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'booking_series' and policyname = 'Allow delete own series'
  ) then
    create policy "Allow delete own series" on public.booking_series for delete
      using (user_id = auth.uid());
  end if;
end$$;

-- Add series linkage to bookings
alter table public.bookings
  add column if not exists series_id uuid references public.booking_series(id) on delete set null,
  add column if not exists occurrence_index integer check (occurrence_index >= 0),
  add column if not exists is_conflicted boolean not null default false;

create index if not exists bookings_series_id_idx on public.bookings(series_id);
create index if not exists bookings_series_occurrence_idx on public.bookings(series_id, occurrence_index);

-- Keep updated_at fresh on updates
create or replace function public.set_booking_series_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists set_booking_series_updated_at on public.booking_series;
create trigger set_booking_series_updated_at
before update on public.booking_series
for each row execute function public.set_booking_series_updated_at();

commit;


