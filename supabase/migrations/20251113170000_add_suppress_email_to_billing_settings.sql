-- Add suppress_email flag to billing_settings
-- When true, payment emails will not be sent to the patient
-- This allows practitioners to manually handle billing without automatic email notifications

ALTER TABLE billing_settings
  ADD COLUMN IF NOT EXISTS suppress_email BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN billing_settings.suppress_email IS
  'When true, payment emails will not be sent to the patient. Calendar invites may still be sent for future bookings.';

-- Create index for efficient querying (optional but helpful)
CREATE INDEX IF NOT EXISTS idx_billing_settings_suppress_email
  ON billing_settings (suppress_email)
  WHERE suppress_email = TRUE;

