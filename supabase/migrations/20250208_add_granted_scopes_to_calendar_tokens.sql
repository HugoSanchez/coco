-- Add granted_scopes column to calendar_tokens table
-- This tracks the actual permissions granted by the user during OAuth
-- Helps detect when users grant partial permissions (e.g., only profile access, not calendar access)

ALTER TABLE calendar_tokens
ADD COLUMN granted_scopes TEXT[] DEFAULT NULL;

-- Add index for efficient scope queries
CREATE INDEX idx_calendar_tokens_granted_scopes ON calendar_tokens USING GIN (granted_scopes);

-- Add comment explaining the new column
COMMENT ON COLUMN calendar_tokens.granted_scopes IS 'Array of OAuth scopes actually granted by the user (e.g., calendar.events, userinfo.email)';
