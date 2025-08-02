-- Fix foreign keys to point to public.profiles instead of auth.users
-- This migration is safe because profiles.id = auth.users.id (same UUIDs)

-- 1. Drop existing foreign keys that point to auth.users
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_user_id_fkey;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_user_id_fkey;
ALTER TABLE public.calendar_tokens DROP CONSTRAINT IF EXISTS calendar_tokens_user_id_fkey;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_user_id_fkey;
ALTER TABLE public.billing_settings DROP CONSTRAINT IF EXISTS billing_preferences_user_id_fkey;
ALTER TABLE public.stripe_accounts DROP CONSTRAINT IF EXISTS stripe_accounts_user_id_fkey;
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_user_id_fkey;

-- 2. Create new foreign keys pointing to public.profiles
ALTER TABLE public.bills
  ADD CONSTRAINT bills_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE NO ACTION;

ALTER TABLE public.calendar_tokens
  ADD CONSTRAINT calendar_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.billing_settings
  ADD CONSTRAINT billing_settings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.stripe_accounts
  ADD CONSTRAINT stripe_accounts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
