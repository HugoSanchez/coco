-- Create billing preferences table
CREATE TABLE billing_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  default_billing_type TEXT NOT NULL CHECK (default_billing_type IN ('in-advance', 'right-after', 'monthly')),
  default_amount NUMERIC NOT NULL,
  default_currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id) -- One preference per user
);

-- Add RLS policies
ALTER TABLE billing_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own billing preferences
CREATE POLICY "Users can view own billing preferences" ON billing_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own billing preferences" ON billing_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own billing preferences" ON billing_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own billing preferences" ON billing_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_billing_preferences_updated_at
  BEFORE UPDATE ON billing_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
