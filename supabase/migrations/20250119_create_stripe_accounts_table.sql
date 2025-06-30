-- Create stripe_accounts table
CREATE TABLE stripe_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_account_id TEXT NOT NULL UNIQUE,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    payments_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_stripe_accounts_user_id ON stripe_accounts(user_id);
CREATE INDEX idx_stripe_accounts_stripe_account_id ON stripe_accounts(stripe_account_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own stripe accounts
CREATE POLICY "Users can view own stripe accounts" ON stripe_accounts
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own stripe accounts
CREATE POLICY "Users can insert own stripe accounts" ON stripe_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own stripe accounts
CREATE POLICY "Users can update own stripe accounts" ON stripe_accounts
    FOR UPDATE USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stripe_accounts_updated_at
    BEFORE UPDATE ON stripe_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
