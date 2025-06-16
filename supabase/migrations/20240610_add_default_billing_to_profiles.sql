ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_billing_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS default_billing_type TEXT CHECK (default_billing_type IN ('recurring', 'consultation_based', 'project_based')),
  ADD COLUMN IF NOT EXISTS default_billing_frequency TEXT CHECK (default_billing_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  ADD COLUMN IF NOT EXISTS default_billing_trigger TEXT CHECK (default_billing_trigger IN ('after_consultation', 'before_consultation')),
  ADD COLUMN IF NOT EXISTS default_billing_advance_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_should_bill BOOLEAN DEFAULT false;
