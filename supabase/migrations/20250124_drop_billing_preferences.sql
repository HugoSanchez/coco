-- Drop billing_preferences table since we're using unified billing_settings
-- The billing_settings table now handles user defaults, client overrides, and booking-specific settings

-- Drop the billing_preferences table
DROP TABLE IF EXISTS public.billing_preferences CASCADE;

-- Add comment to document the change
COMMENT ON TABLE public.billing_settings IS 'Unified billing configurations with three-level hierarchy: user defaults (client_id=NULL, booking_id=NULL, is_default=true), client overrides (booking_id=NULL), and booking-specific settings';
