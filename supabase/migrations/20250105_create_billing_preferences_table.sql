-- Create billing_preferences table
CREATE TABLE billing_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  billing_amount DECIMAL(10,2),
  billing_type TEXT CHECK (billing_type IN ('recurring', 'consultation_based', 'project_based')),
  billing_frequency TEXT CHECK (billing_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  billing_trigger TEXT CHECK (billing_trigger IN ('after_consultation', 'before_consultation')),
  billing_advance_days INTEGER DEFAULT 0,
  should_bill BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add unique constraint to ensure one billing preference per user
ALTER TABLE billing_preferences ADD CONSTRAINT unique_user_billing UNIQUE (user_id);

-- Remove billing columns from profiles table
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS default_billing_amount,
  DROP COLUMN IF EXISTS default_billing_type,
  DROP COLUMN IF EXISTS default_billing_frequency,
  DROP COLUMN IF EXISTS default_billing_trigger,
  DROP COLUMN IF EXISTS default_billing_advance_days,
  DROP COLUMN IF EXISTS default_should_bill;

-- Enable RLS on billing_preferences table
ALTER TABLE billing_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for billing_preferences
CREATE POLICY "Users can only view their own billing preferences" ON billing_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own billing preferences" ON billing_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own billing preferences" ON billing_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own billing preferences" ON billing_preferences
  FOR DELETE USING (auth.uid() = user_id);
