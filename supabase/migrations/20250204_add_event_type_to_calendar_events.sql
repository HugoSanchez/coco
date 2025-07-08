-- Add event_type column to calendar_events table
-- This tracks whether the event is a pending placeholder or a confirmed appointment

ALTER TABLE calendar_events
ADD COLUMN event_type TEXT NOT NULL DEFAULT 'pending'
CHECK (event_type IN ('pending', 'confirmed'));

-- Add index for efficient queries by event type
CREATE INDEX idx_calendar_events_event_type ON calendar_events(event_type);

-- Add comment explaining the new column
COMMENT ON COLUMN calendar_events.event_type IS 'Event status: pending (placeholder before payment) or confirmed (full appointment after payment)';

-- Update existing records to be 'confirmed' since they were created after payment
UPDATE calendar_events SET event_type = 'confirmed' WHERE event_type = 'pending';
