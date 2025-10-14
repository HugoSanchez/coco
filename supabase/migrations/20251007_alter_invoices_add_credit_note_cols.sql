-- Add credit note support to invoices
-- Up
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS document_kind TEXT NOT NULL DEFAULT 'invoice' CHECK (document_kind IN ('invoice','credit_note')),
  ADD COLUMN IF NOT EXISTS rectifies_invoice_id UUID NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT NULL;

-- Helpful index for lookups of credit notes by original invoice
CREATE INDEX IF NOT EXISTS idx_invoices_rectifies_invoice_id ON invoices(rectifies_invoice_id);

-- Down (no-op for safety)
-- ALTER TABLE invoices DROP COLUMN document_kind;
-- ALTER TABLE invoices DROP COLUMN rectifies_invoice_id;
-- ALTER TABLE invoices DROP COLUMN reason;
-- ALTER TABLE invoices DROP COLUMN stripe_refund_id;

