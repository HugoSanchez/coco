-- Remove the old simple billing_frequency column
ALTER TABLE public.clients DROP COLUMN IF EXISTS billing_frequency;

-- Add new flexible billing structure
ALTER TABLE public.clients ADD COLUMN billing_type TEXT CHECK (billing_type IN ('recurring', 'consultation_based', 'project_based'));
ALTER TABLE public.clients ADD COLUMN billing_frequency TEXT CHECK (billing_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly'));
ALTER TABLE public.clients ADD COLUMN billing_trigger TEXT CHECK (billing_trigger IN ('after_consultation', 'before_consultation'));
ALTER TABLE public.clients ADD COLUMN billing_advance_days INTEGER DEFAULT 0;

-- Add some helpful comments
COMMENT ON COLUMN public.clients.billing_type IS 'Type of billing: recurring (regular intervals), consultation_based (per session), project_based (one-time)';
COMMENT ON COLUMN public.clients.billing_frequency IS 'For recurring billing: how often to bill (weekly, monthly, etc.)';
COMMENT ON COLUMN public.clients.billing_trigger IS 'For consultation_based: when to bill relative to the consultation';
COMMENT ON COLUMN public.clients.billing_advance_days IS 'For before_consultation trigger: how many days in advance to bill';
