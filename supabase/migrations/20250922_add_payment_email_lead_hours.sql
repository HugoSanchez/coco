-- Add lead time configuration to billing_settings
-- NULL or 0 => send immediately when booking is created
-- Positive hours (e.g., 24, 72, 168) => send that many hours before start_time
-- -1 => send after consultation (at end_time)

ALTER TABLE billing_settings
  ADD COLUMN IF NOT EXISTS payment_email_lead_hours INTEGER NULL
  CHECK (payment_email_lead_hours >= -1);

COMMENT ON COLUMN billing_settings.payment_email_lead_hours IS
  'Timing for payment email: NULL/0=immediate, 24/72/168=hours before start_time, -1=after (at end_time).';


