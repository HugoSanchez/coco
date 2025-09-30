-- Step 1: Add booking mode and location fields; add practitioner default location
-- - bookings.mode: 'online' | 'in_person' (default 'online')
-- - bookings.location_text: free-text location for in-person appointments
-- - profiles.default_in_person_location_text: practitioner default location

-- Bookings: add mode with default 'online' (non-null), and a check constraint to keep values bounded
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'online';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_mode_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_mode_check
      CHECK (mode IN ('online', 'in_person'));
  END IF;
END$$;

-- Bookings: optional free-text location for in-person appointments
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS location_text text NULL;

-- Optional: lightweight index to help filter by mode (harmless at small scale)
CREATE INDEX IF NOT EXISTS idx_bookings_mode ON public.bookings (mode);

-- Profiles: practitioner default in-person location (used to prefill forms)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_in_person_location_text text NULL;

-- Notes:
-- - No data migrations are necessary; existing rows default to 'online'.
-- - Application should treat NULL mode as 'online' defensively (though column is NOT NULL).
-- - Application may include location_text in calendar event 'location' when mode = 'in_person'.



