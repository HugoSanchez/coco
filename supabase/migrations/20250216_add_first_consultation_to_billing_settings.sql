-- Add optional first consultation amount to billing_settings

ALTER TABLE billing_settings
  ADD COLUMN IF NOT EXISTS first_consultation_amount DECIMAL(10,2) NULL
  CHECK (first_consultation_amount >= 0);

COMMENT ON COLUMN billing_settings.first_consultation_amount IS
  'Optional price for the very first consultation. Null => fallback to billing_amount.';
