-- Bills: add scheduling metadata and lightweight lock, plus index for picker

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS email_scheduled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS email_send_locked_at TIMESTAMPTZ NULL;

-- Partial index to efficiently pick due emails
CREATE INDEX IF NOT EXISTS idx_bills_scheduled_send
  ON bills (email_scheduled_at)
  WHERE status = 'pending'
    AND sent_at IS NULL
    AND email_scheduled_at IS NOT NULL;


