-- Create calendar_events table to track Google Calendar events for bookings
-- This table stores Google Calendar event IDs so we can update/cancel events later

CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    google_event_id TEXT NOT NULL UNIQUE,
    google_meet_link TEXT,
    event_status TEXT NOT NULL DEFAULT 'created' CHECK (event_status IN ('created', 'updated', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX idx_calendar_events_booking_id ON calendar_events(booking_id);
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_google_event_id ON calendar_events(google_event_id);
CREATE INDEX idx_calendar_events_status ON calendar_events(event_status);

-- Add comments to explain the table purpose
COMMENT ON TABLE calendar_events IS 'Tracks Google Calendar events created for bookings';
COMMENT ON COLUMN calendar_events.booking_id IS 'References the booking this calendar event belongs to';
COMMENT ON COLUMN calendar_events.user_id IS 'References the practitioner who owns the calendar (auth.users.id)';
COMMENT ON COLUMN calendar_events.google_event_id IS 'Google Calendar event ID for updates/cancellations';
COMMENT ON COLUMN calendar_events.google_meet_link IS 'Google Meet conference link for the event';
COMMENT ON COLUMN calendar_events.event_status IS 'Tracks the lifecycle of the calendar event';
