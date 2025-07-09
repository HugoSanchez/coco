-- Add Row Level Security to payment_sessions table
-- Users should only access payment sessions for their own bookings

-- Enable RLS on payment_sessions table
ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view payment sessions for their own bookings
CREATE POLICY "Users can view own payment sessions" ON payment_sessions
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        )
    );

-- Policy: Users can insert payment sessions for their own bookings
CREATE POLICY "Users can insert own payment sessions" ON payment_sessions
    FOR INSERT WITH CHECK (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        )
    );

-- Policy: Users can update payment sessions for their own bookings
CREATE POLICY "Users can update own payment sessions" ON payment_sessions
    FOR UPDATE USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        )
    );

-- Policy: Users can delete payment sessions for their own bookings
CREATE POLICY "Users can delete own payment sessions" ON payment_sessions
    FOR DELETE USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        )
    );

-- Add comment explaining the security model
COMMENT ON TABLE payment_sessions IS 'Payment session tracking for Stripe payments. RLS enabled - users can only access payment sessions for their own bookings.';
