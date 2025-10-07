-- Schema changes to support scheduled and monthly invoicing
-- Up
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS cadence TEXT NOT NULL DEFAULT 'per_booking' CHECK (cadence IN ('per_booking','monthly')),
  ADD COLUMN IF NOT EXISTS service_date TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS billed_invoice_id UUID NULL REFERENCES invoices(id);

-- Helpful indexes for the crons
CREATE INDEX IF NOT EXISTS idx_invoice_items_per_booking_sched ON invoice_items (cadence, scheduled_send_at, billed_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_monthly_period ON invoice_items (cadence, service_date, billed_invoice_id);

-- Down (no-op for safety)
-- ALTER TABLE invoice_items DROP COLUMN cadence;
-- ALTER TABLE invoice_items DROP COLUMN service_date;
-- ALTER TABLE invoice_items DROP COLUMN scheduled_send_at;
-- ALTER TABLE invoice_items DROP COLUMN billed_invoice_id;

