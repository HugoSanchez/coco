-- Add calendar_id column to calendar_tokens table
-- This allows users to specify a custom Google Calendar ID for their Coco events
-- If null, events will be created in the user's primary calendar (backwards compatible)

ALTER TABLE calendar_tokens
ADD COLUMN calendar_id TEXT DEFAULT NULL;

-- Add comment explaining the new column
COMMENT ON COLUMN calendar_tokens.calendar_id IS 'Optional Google Calendar ID for dedicated Coco calendar. If null, uses primary calendar.';

