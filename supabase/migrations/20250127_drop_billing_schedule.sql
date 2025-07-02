-- Drop billing_schedule table and related functions
-- This table was part of the old complex billing system and is no longer needed
-- The new simplified billing system uses a snapshot approach with billing data stored directly in bookings

-- Drop the consultation billing function that uses billing_schedule
DROP FUNCTION IF EXISTS get_consultation_billing(DATE);

-- Drop the billing schedule table and all its dependencies
DROP TABLE IF EXISTS billing_schedule CASCADE;

-- Drop the trigger function as well since it was only used by billing_schedule
DROP FUNCTION IF EXISTS update_billing_schedule_updated_at();

-- Add comment to document the change
COMMENT ON TABLE billing_settings IS 'Unified billing configurations with three-level hierarchy: user defaults (client_id=NULL, booking_id=NULL, is_default=true), client overrides (booking_id=NULL), and booking-specific settings. The billing_schedule table was removed as the new system uses immediate billing without complex scheduling.';
