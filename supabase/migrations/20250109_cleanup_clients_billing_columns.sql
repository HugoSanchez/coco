-- Remove billing columns from clients table since they're now in billing_settings
-- This migration cleans up the clients table to focus only on client information

-- Remove billing-related columns from clients table
ALTER TABLE public.clients
DROP COLUMN IF EXISTS should_bill,
DROP COLUMN IF EXISTS billing_amount,
DROP COLUMN IF EXISTS billing_type,
DROP COLUMN IF EXISTS billing_frequency,
DROP COLUMN IF EXISTS billing_trigger,
DROP COLUMN IF EXISTS billing_advance_days;

-- Add comment to clarify the simplified clients table
COMMENT ON TABLE public.clients IS 'Client information - billing settings are now handled separately in billing_settings table';
