-- Add last_name column to clients table
-- This allows splitting client names into first and last names for better organization

ALTER TABLE public.clients
ADD COLUMN last_name TEXT;

-- Add index for performance on name searches
CREATE INDEX IF NOT EXISTS clients_last_name_idx ON public.clients(last_name);

-- Add comment to document the change
COMMENT ON COLUMN public.clients.last_name IS 'Client last name - optional field for better name organization';
