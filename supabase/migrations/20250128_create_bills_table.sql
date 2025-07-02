-- Create bills table for individual consultation charges
-- Each booking generates one bill, bills can be aggregated into invoices
-- This follows the domain separation: bookings (scheduling) vs bills (financial)

CREATE TABLE bills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Relationships
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

    -- Bill Identity
    bill_number VARCHAR(50) UNIQUE NOT NULL, -- e.g., "BILL-2025-001"

    -- Financial Details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR' NOT NULL,
    due_date TIMESTAMPTZ, -- Automatically calculated based on billing_type
	 -- Billing Configuration Snapshot
    billing_type VARCHAR(20) NOT NULL CHECK (billing_type IN ('in-advance', 'right-after', 'monthly')),

    -- Status Management
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    -- Status values: 'pending', 'sent', 'paid', 'disputed', 'canceled'

        -- Timeline Tracking
    sent_at TIMESTAMPTZ,     -- When bill was sent to client
    paid_at TIMESTAMPTZ,     -- When payment was received

    -- Snapshot Data (essential info at time of bill creation)
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255) NOT NULL,

    -- Optional Fields
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT bills_status_check CHECK (status IN ('pending', 'sent', 'paid', 'disputed', 'canceled')),
    CONSTRAINT bills_amount_positive CHECK (amount > 0),
    CONSTRAINT bills_sent_before_paid CHECK (sent_at IS NULL OR paid_at IS NULL OR sent_at <= paid_at)
);

-- Indexes for Performance
CREATE INDEX idx_bills_booking_id ON bills(booking_id);
CREATE INDEX idx_bills_user_id ON bills(user_id);
CREATE INDEX idx_bills_client_id ON bills(client_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_due_date ON bills(due_date);
CREATE INDEX idx_bills_billing_type ON bills(billing_type);
CREATE INDEX idx_bills_created_at ON bills(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_bills_user_status ON bills(user_id, status);
CREATE INDEX idx_bills_client_status ON bills(client_id, status);

-- Row Level Security
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- Users can only access bills for their own bookings
CREATE POLICY "Users can manage their own bills" ON bills
    FOR ALL USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bills_updated_at
    BEFORE UPDATE ON bills
    FOR EACH ROW
    EXECUTE FUNCTION update_bills_updated_at();

-- Trigger function to automatically calculate due_date based on billing_type
CREATE OR REPLACE FUNCTION calculate_bill_due_date()
RETURNS TRIGGER AS $$
DECLARE
    booking_end_time TIMESTAMPTZ;
BEGIN
    CASE NEW.billing_type
        WHEN 'in-advance' THEN
            -- Due immediately when bill is created
            NEW.due_date := NEW.created_at;

        WHEN 'right-after' THEN
            -- Get the booking end time and add 5 minutes
            SELECT end_time::TIMESTAMPTZ INTO booking_end_time
            FROM bookings
            WHERE id = NEW.booking_id;

            NEW.due_date := booking_end_time + INTERVAL '5 minutes';

        WHEN 'monthly' THEN
            -- Due at end of current month (11:59 PM on last day)
            NEW.due_date := (DATE_TRUNC('month', NEW.created_at) + INTERVAL '1 month - 1 minute')::TIMESTAMPTZ;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to calculate due_date on bill creation
CREATE TRIGGER calculate_bill_due_date_trigger
    BEFORE INSERT ON bills
    FOR EACH ROW
    EXECUTE FUNCTION calculate_bill_due_date();

-- Helper function to generate bill numbers
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
    year_suffix TEXT;
    next_number INTEGER;
    bill_number TEXT;
BEGIN
    -- Get current year (last 2 digits)
    year_suffix := RIGHT(EXTRACT(YEAR FROM NOW())::TEXT, 2);

    -- Get the next sequential number for this year
    SELECT COALESCE(MAX(
        CASE
            WHEN bill_number ~ ('^CONSULTATION-' || year_suffix || '-[0-9]+$')
            THEN CAST(SPLIT_PART(bill_number, '-', 3) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_number
    FROM bills;

    -- Format as BILL-YY-NNN (e.g., BILL-25-001)
    bill_number := 'CONSULTATION-' || year_suffix || '-' || LPAD(next_number::TEXT, 3, '0');

    RETURN bill_number;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE bills IS 'Individual charges for consultations. Each booking generates one bill. Bills can be aggregated into invoices for customer billing.';
COMMENT ON COLUMN bills.bill_number IS 'Unique bill identifier in format BILL-YY-NNN';
COMMENT ON COLUMN bills.status IS 'Bill lifecycle: pending (created) → sent (delivered to client) → paid (payment received)';
COMMENT ON COLUMN bills.billing_type IS 'Snapshot of billing type when bill was created (in-advance, right-after, monthly)';
COMMENT ON COLUMN bills.due_date IS 'Automatically calculated: in-advance (bill creation), right-after (consultation end + 5min), monthly (end of month)';
