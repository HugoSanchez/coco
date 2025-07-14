-- Add computed column for full name search to clients table
-- This will enable efficient searching across first name + last name combinations
-- Handles cases like "Hugo", "Sanchez", or "Hugo Sanchez"

-- Enable trigram extension first (for better text search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add the computed column that concatenates name and last_name with proper spacing
ALTER TABLE clients
ADD COLUMN full_name_search TEXT
GENERATED ALWAYS AS (
  CASE
    WHEN last_name IS NULL OR last_name = '' THEN name
    ELSE name || ' ' || last_name
  END
) STORED;

-- Create a simple B-tree index first (reliable and fast for ILIKE queries)
CREATE INDEX idx_clients_full_name_search
ON clients (full_name_search);

-- Add comment for documentation
COMMENT ON COLUMN clients.full_name_search IS 'Computed column combining name and last_name for efficient full-name searching. Handles null last_name gracefully.';
