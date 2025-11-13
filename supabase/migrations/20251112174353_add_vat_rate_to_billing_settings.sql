-- Add VAT rate column to billing_settings
-- This allows storing VAT/IVA rate per client or user default
-- - vat_rate_percent: VAT rate as percentage (e.g., 21.00 for 21%)
-- - NULL means no VAT applies
-- - Stored at client-specific level (client_id IS NOT NULL) or user default level

ALTER TABLE public.billing_settings
ADD COLUMN vat_rate_percent NUMERIC(5,2) DEFAULT NULL;

-- Add helpful comments
COMMENT ON COLUMN public.billing_settings.vat_rate_percent IS 'VAT/IVA rate as percentage (e.g., 21.00 for 21%). NULL means no VAT applies. Can be set per client or as user default.';

