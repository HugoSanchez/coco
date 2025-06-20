-- Add billing and payment tracking fields to bookings table
ALTER TABLE bookings
ADD COLUMN billing_status TEXT DEFAULT 'pending' CHECK (billing_status IN ('pending', 'billed', 'cancelled', 'failed')),
ADD COLUMN payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
ADD COLUMN billed_at TIMESTAMPTZ,
ADD COLUMN paid_at TIMESTAMPTZ;

-- Add indexes for efficient queries
CREATE INDEX idx_bookings_billing_status ON bookings(billing_status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_billed_at ON bookings(billed_at);
