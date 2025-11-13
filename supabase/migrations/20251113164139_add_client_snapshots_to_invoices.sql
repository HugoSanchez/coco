-- Add client national_id and address snapshots to invoices table
-- These fields capture client data at the time of invoice creation for historical accuracy
-- Immutable once invoice is issued

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS client_national_id_snapshot TEXT,
ADD COLUMN IF NOT EXISTS client_address_snapshot TEXT;

-- Add comments to document the new fields
COMMENT ON COLUMN public.invoices.client_national_id_snapshot IS 'Client national ID (e.g., DNI) snapshot at invoice creation - optional field';
COMMENT ON COLUMN public.invoices.client_address_snapshot IS 'Client address snapshot at invoice creation - optional field';

