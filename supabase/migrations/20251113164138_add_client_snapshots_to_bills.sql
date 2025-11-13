-- Add client national_id and address snapshots to bills table
-- These fields capture client data at the time of bill creation for historical accuracy

ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS client_national_id_snapshot TEXT,
ADD COLUMN IF NOT EXISTS client_address_snapshot TEXT;

-- Add comments to document the new fields
COMMENT ON COLUMN public.bills.client_national_id_snapshot IS 'Client national ID (e.g., DNI) snapshot at bill creation - optional field';
COMMENT ON COLUMN public.bills.client_address_snapshot IS 'Client address snapshot at bill creation - optional field';

