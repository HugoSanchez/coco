-- Fix the unique constraint issue
-- The previous migration missed removing the 'unique_user_billing' constraint

-- Remove the old constraint that prevents multiple billing settings per user
ALTER TABLE public.billing_settings DROP CONSTRAINT IF EXISTS unique_user_billing;

-- Verify the new unique indexes are in place (they should be from the previous migration)
-- These allow multiple billing settings per user with proper constraints:
-- - billing_settings_user_default_idx: Only one default per user
-- - billing_settings_client_override_idx: Only one setting per (user, client) pair
-- - billing_settings_booking_specific_idx: Only one setting per booking
