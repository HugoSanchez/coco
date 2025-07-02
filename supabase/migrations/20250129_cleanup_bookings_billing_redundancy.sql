-- Remove redundant billing columns from bookings table
-- These are now tracked in the bills table
-- Keep billing_settings_id for audit trail and payment_session_id for payments

-- Remove redundant billing tracking columns
ALTER TABLE bookings
DROP COLUMN IF EXISTS billed_at,
DROP COLUMN IF EXISTS billing_amount,
DROP COLUMN IF EXISTS billing_currency,
DROP COLUMN IF EXISTS billing_status,
DROP COLUMN IF EXISTS billing_type,
DROP COLUMN IF EXISTS paid_at;

-- Note: Keep billing_settings_id (audit trail) and payment_session_id (payment processing)
