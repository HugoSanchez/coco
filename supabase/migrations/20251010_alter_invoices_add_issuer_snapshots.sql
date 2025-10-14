-- Add immutable issuer snapshots to invoices (filled at issuance time)
-- Up
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS issuer_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS issuer_tax_id_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS issuer_address_snapshot JSONB;

-- Down (no-op for safety)
-- ALTER TABLE invoices DROP COLUMN issuer_name_snapshot;
-- ALTER TABLE invoices DROP COLUMN issuer_tax_id_snapshot;
-- ALTER TABLE invoices DROP COLUMN issuer_address_snapshot;

