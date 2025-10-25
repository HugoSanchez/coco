-- Add last_name and generated full_name to profiles
-- Idempotent: safe to re-run on environments where columns may already exist

begin;

-- last_name (nullable)
do $$
begin
    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name   = 'profiles'
          and column_name  = 'last_name'
    ) then
        alter table public.profiles
            add column last_name text;
    end if;
end $$;

-- full_name generated as name + space + last_name (trimmed)
do $$
begin
    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name   = 'profiles'
          and column_name  = 'full_name'
    ) then
        alter table public.profiles
            add column full_name text generated always as (
                btrim(
                    coalesce(name, '') ||
                    case when coalesce(last_name, '') <> '' then ' ' || last_name else '' end
                )
            ) stored;
    end if;
end $$;

-- Optional: index if you plan to filter/order by full_name
-- create index if not exists idx_profiles_full_name on public.profiles(full_name);

commit;


