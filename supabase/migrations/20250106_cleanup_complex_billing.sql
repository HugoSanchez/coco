-- Cleanup Complex Billing System
-- Remove all the overcomplicated tables and constraints

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.billing_records CASCADE;
DROP TABLE IF EXISTS public.billing_configurations CASCADE;

-- Drop the bookings table if it was created by our migration
-- (Only if it doesn't have important data)
-- DROP TABLE IF EXISTS public.bookings CASCADE;

-- Drop any functions we created
DROP FUNCTION IF EXISTS get_billing_configuration_for_booking(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Clean up any leftover sequences or types
-- (PostgreSQL will handle most cleanup automatically with CASCADE)

-- Add comment
COMMENT ON SCHEMA public IS 'Cleaned up complex billing system - starting fresh';
