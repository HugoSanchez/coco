-- Migration: Create function for consultation billing
-- This function returns consultation-based billing data that's due for processing

CREATE OR REPLACE FUNCTION get_consultation_billing(today_date DATE)
RETURNS TABLE (
  booking_id UUID,
  scheduled_date DATE,
  consultation_date DATE,
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  billing_settings_id UUID,
  billing_amount NUMERIC,
  billing_trigger TEXT,
  billing_advance_days INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    bs.booking_id,
    bs.scheduled_date,
    b.start_time::DATE as consultation_date,
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    billing.id as billing_settings_id,
    billing.billing_amount,
    billing.billing_trigger,
    billing.billing_advance_days
  FROM billing_schedule bs
  JOIN bookings b ON bs.booking_id = b.id
  JOIN billing_settings billing ON b.billing_settings_id = billing.id
  JOIN clients c ON b.client_id = c.id
  WHERE
    bs.scheduled_date <= today_date
    AND bs.status = 'pending'
    AND billing.billing_type = 'consultation_based';
$$;
