-- Add per-line linkage for credit notes
-- Up
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS rectifies_item_id UUID NULL REFERENCES invoice_items(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_invoice_items_rectifies_item_id ON invoice_items(rectifies_item_id);

-- Down (no-op for safety)
-- ALTER TABLE invoice_items DROP COLUMN rectifies_item_id;

