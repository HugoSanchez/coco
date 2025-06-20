-- Create billing schedule table for efficient cron job processing
CREATE TABLE billing_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- What needs to be done
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('send_bill', 'payment_reminder', 'overdue_notice')),

    -- When it should be done
    scheduled_date DATE NOT NULL,

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    processed_at TIMESTAMPTZ,

    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate entries
    UNIQUE(booking_id, action_type)
);

-- Indexes for efficient cron job queries
CREATE INDEX idx_billing_schedule_date_status ON billing_schedule(scheduled_date, status);
CREATE INDEX idx_billing_schedule_booking_id ON billing_schedule(booking_id);
CREATE INDEX idx_billing_schedule_action_type ON billing_schedule(action_type);

-- RLS policies
ALTER TABLE billing_schedule ENABLE ROW LEVEL SECURITY;

-- Users can only see schedules for their own bookings
CREATE POLICY "Users can view own billing schedules" ON billing_schedule
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        )
    );

-- System can manage all schedules (for cron jobs)
CREATE POLICY "System can manage billing schedules" ON billing_schedule
    FOR ALL USING (true);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_billing_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_billing_schedule_updated_at
    BEFORE UPDATE ON billing_schedule
    FOR EACH ROW
    EXECUTE FUNCTION update_billing_schedule_updated_at();
