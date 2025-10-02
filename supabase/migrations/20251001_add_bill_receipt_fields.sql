-- Add Stripe receipt metadata to bills
-- Purpose: persist Stripe charge and hosted receipt URL for each paid bill,
--          and track when we emailed the receipt to the patient.

ALTER TABLE bills
ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_receipt_url TEXT,
ADD COLUMN IF NOT EXISTS stripe_receipt_email_sent_at TIMESTAMPTZ;

-- Helpful index for reverse lookups by charge id (nullable)
CREATE INDEX IF NOT EXISTS idx_bills_stripe_charge_id ON bills(stripe_charge_id);

-- Notes:
-- - We keep the canonical receipt link as the Stripe-hosted receipt_url.
-- - Email send timestamp is recorded after a successful send from our email service.
-- - This migration is additive and safe to rerun.


