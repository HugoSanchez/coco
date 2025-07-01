-- Normalize bookings table to remove billing data duplication
-- All billing information is now stored in billing_settings table

-- Make billing_settings_id required (assuming all bookings already have valid references)
ALTER TABLE bookings
ALTER COLUMN billing_settings_id SET NOT NULL;

-- Remove redundant billing columns since they're stored in billing_settings
ALTER TABLE bookings
DROP COLUMN IF EXISTS billing_type,
DROP COLUMN IF EXISTS billing_amount,
DROP COLUMN IF EXISTS billing_currency;
