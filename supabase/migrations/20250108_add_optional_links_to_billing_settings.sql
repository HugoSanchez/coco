-- Add optional client_id, booking_id, and is_default to billing_settings
-- Keep it simple but flexible

-- Add the new columns
ALTER TABLE public.billing_settings
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
ADD COLUMN booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
ADD COLUMN is_default BOOLEAN DEFAULT false;

-- Create simple indexes for performance
CREATE INDEX IF NOT EXISTS billing_settings_client_id_idx ON public.billing_settings(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS billing_settings_booking_id_idx ON public.billing_settings(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS billing_settings_is_default_idx ON public.billing_settings(is_default) WHERE is_default = true;

-- Update the unique constraint to handle the hierarchy
-- Remove the old simple unique constraint
ALTER TABLE public.billing_settings DROP CONSTRAINT IF EXISTS billing_settings_user_id_key;

-- Add a more flexible unique constraint that handles:
-- - User defaults: (user_id) where client_id IS NULL AND booking_id IS NULL AND is_default = true
-- - Client overrides: (user_id, client_id) where booking_id IS NULL
-- - Booking specific: (booking_id) - always unique regardless of user/client
CREATE UNIQUE INDEX IF NOT EXISTS billing_settings_user_default_idx
ON public.billing_settings (user_id)
WHERE (client_id IS NULL AND booking_id IS NULL AND is_default = true);

CREATE UNIQUE INDEX IF NOT EXISTS billing_settings_client_override_idx
ON public.billing_settings (user_id, client_id)
WHERE (booking_id IS NULL AND client_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS billing_settings_booking_specific_idx
ON public.billing_settings (booking_id)
WHERE (booking_id IS NOT NULL);

-- Add helpful comments
COMMENT ON COLUMN public.billing_settings.client_id IS 'Optional: Link to specific client for client-specific billing settings';
COMMENT ON COLUMN public.billing_settings.booking_id IS 'Optional: Link to specific booking for booking-specific billing settings';
COMMENT ON COLUMN public.billing_settings.is_default IS 'True for user default settings (when client_id and booking_id are NULL)';
