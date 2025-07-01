-- Update bookings table for simplified billing structure

-- Add new billing columns
ALTER TABLE bookings
ADD COLUMN billing_type TEXT CHECK (billing_type IN ('in-advance', 'right-after', 'monthly')),
ADD COLUMN billing_amount NUMERIC,
ADD COLUMN billing_currency TEXT DEFAULT 'EUR',
ADD COLUMN payment_session_id UUID REFERENCES payment_sessions(id);

-- Remove payment_status column (we'll use payment_sessions.status instead)
ALTER TABLE bookings DROP COLUMN IF EXISTS payment_status;

-- Update status column constraint to ensure it has the correct values
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
CHECK (status IN ('pending', 'scheduled', 'completed', 'canceled'));

-- Update billing_status constraint to ensure it has the correct values
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_billing_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_billing_status_check
CHECK (billing_status IN ('pending', 'billed', 'paid', 'failed'));
