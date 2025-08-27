-- Add consultation_type to bookings and an index for fast lookups

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS consultation_type VARCHAR(16) NULL
  CHECK (consultation_type IN ('first','followup'));

CREATE INDEX IF NOT EXISTS idx_bookings_user_client_status
  ON bookings(user_id, client_id, status);

COMMENT ON COLUMN bookings.consultation_type IS
  'Per booking: first | followup. Null allowed for legacy rows.';
