ALTER TABLE public.profiles
  ADD COLUMN default_booking_mode text NOT NULL DEFAULT 'online'
  CONSTRAINT profiles_default_booking_mode_check
  CHECK (default_booking_mode IN ('online', 'in_person'));
