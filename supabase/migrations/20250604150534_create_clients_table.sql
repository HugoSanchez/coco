-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    description TEXT,
    billing_amount DECIMAL(10,2),
    billing_frequency TEXT CHECK (billing_frequency IN ('hourly', 'daily', 'weekly', 'monthly', 'yearly', 'project')),
    should_bill BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint to auth.users
ALTER TABLE public.clients
ADD CONSTRAINT clients_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS clients_user_id_idx ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS clients_email_idx ON public.clients(email);

-- Enable Row Level Security (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own clients
CREATE POLICY "Users can view their own clients" ON public.clients
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own clients
CREATE POLICY "Users can insert their own clients" ON public.clients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own clients
CREATE POLICY "Users can update their own clients" ON public.clients
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own clients
CREATE POLICY "Users can delete their own clients" ON public.clients
    FOR DELETE USING (auth.uid() = user_id);
