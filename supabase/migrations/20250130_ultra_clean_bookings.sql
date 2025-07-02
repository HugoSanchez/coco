-- Remove remaining redundant columns from bookings table
-- These create unnecessary dependencies and circular references

-- Remove billing_settings_id (bills table already tracks billing details)
ALTER TABLE bookings DROP COLUMN IF EXISTS billing_settings_id;

-- Remove payment_session_id (payment_sessions already references booking_id)
ALTER TABLE bookings DROP COLUMN IF EXISTS payment_session_id;

-- Result: Ultra-clean bookings table focused purely on scheduling
