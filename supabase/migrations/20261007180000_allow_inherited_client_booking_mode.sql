-- NULL means that the patient inherits the professional's current default.
ALTER TABLE public.clients
  ALTER COLUMN default_booking_mode DROP NOT NULL,
  ALTER COLUMN default_booking_mode DROP DEFAULT;

-- The initial migration assigned Online to all existing patients. Restore
-- inheritance for those legacy values, preserving Presencial and newer patients.
-- Cutoff: preparation time of the initial migration applied on this project.
UPDATE public.clients
SET default_booking_mode = NULL
WHERE default_booking_mode = 'online'
  AND GREATEST(created_at, updated_at) < TIMESTAMPTZ '2026-10-07 15:45:04+00';
