ALTER TABLE public.clients
  ADD COLUMN default_booking_mode text NOT NULL DEFAULT 'online'
  CONSTRAINT clients_default_booking_mode_check
  CHECK (default_booking_mode IN ('online', 'in_person'));
