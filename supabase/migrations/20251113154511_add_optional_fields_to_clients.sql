-- Add optional fields to clients table
-- These fields allow storing additional client information: phone, national ID, date of birth, and address

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS national_id TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add indexes for better search performance
CREATE INDEX IF NOT EXISTS clients_phone_idx ON public.clients(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS clients_national_id_idx ON public.clients(national_id) WHERE national_id IS NOT NULL;

-- Add comments to document the new fields
COMMENT ON COLUMN public.clients.phone IS 'Client phone number - optional field';
COMMENT ON COLUMN public.clients.national_id IS 'Client national ID (e.g., DNI, SSN, NIN) - optional field';
COMMENT ON COLUMN public.clients.date_of_birth IS 'Client date of birth - optional field';
COMMENT ON COLUMN public.clients.address IS 'Client address - optional field';

