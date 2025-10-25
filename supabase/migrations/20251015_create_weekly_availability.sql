-- Weekly availability per practitioner (normalized: one row per interval)

begin;

create table if not exists public.weekly_availability (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	weekday smallint not null check (weekday between 0 and 6),
	start_time time not null,
	end_time time not null,
	timezone text not null default 'Europe/Madrid',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (end_time > start_time)
);

-- De-dup exact ranges per user/day
create unique index if not exists weekly_availability_unique_range
	on public.weekly_availability (user_id, weekday, start_time, end_time);

-- Fast day lookups
create index if not exists weekly_availability_user_day_idx
	on public.weekly_availability (user_id, weekday);

-- RLS
alter table public.weekly_availability enable row level security;

-- Policies: owner CRUD (drop if exist to avoid re-run errors)
do $$ begin
    if exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'weekly_availability' and policyname = 'wa_select_own'
    ) then
        execute 'drop policy "wa_select_own" on public.weekly_availability';
    end if;
    if exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'weekly_availability' and policyname = 'wa_insert_own'
    ) then
        execute 'drop policy "wa_insert_own" on public.weekly_availability';
    end if;
    if exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'weekly_availability' and policyname = 'wa_update_own'
    ) then
        execute 'drop policy "wa_update_own" on public.weekly_availability';
    end if;
    if exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = 'weekly_availability' and policyname = 'wa_delete_own'
    ) then
        execute 'drop policy "wa_delete_own" on public.weekly_availability';
    end if;
end $$;

create policy "wa_select_own" on public.weekly_availability
    for select using (auth.uid() = user_id);

create policy "wa_insert_own" on public.weekly_availability
    for insert to authenticated with check (auth.uid() = user_id);

create policy "wa_update_own" on public.weekly_availability
    for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "wa_delete_own" on public.weekly_availability
    for delete to authenticated using (auth.uid() = user_id);

-- Trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
	new.updated_at = now();
	return new;
end;
$$ language plpgsql;

create trigger weekly_availability_set_updated_at
	before update on public.weekly_availability
	for each row execute function public.set_updated_at();

commit;
