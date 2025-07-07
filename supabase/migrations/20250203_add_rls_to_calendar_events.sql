-- Add Row Level Security to calendar_events table
-- Users should only be able to access their own calendar events

-- Enable RLS on calendar_events table
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own calendar events
CREATE POLICY "Users can view own calendar events" ON calendar_events
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only insert their own calendar events
CREATE POLICY "Users can insert own calendar events" ON calendar_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own calendar events
CREATE POLICY "Users can update own calendar events" ON calendar_events
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can only delete their own calendar events
CREATE POLICY "Users can delete own calendar events" ON calendar_events
    FOR DELETE USING (auth.uid() = user_id);

-- Add comment explaining the RLS setup
COMMENT ON TABLE calendar_events IS 'Tracks Google Calendar events created for bookings. RLS enabled: users can only access their own events.';
