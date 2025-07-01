-- Simplify billing_settings table for three-type billing system
-- Remove complex billing columns and update billing_type constraints

-- Step 1: Remove the old constraint first to avoid conflicts
DO $$
BEGIN
    -- Drop any existing billing_type constraints
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name LIKE '%billing_type_check%'
               AND table_name = 'billing_settings') THEN
        EXECUTE 'ALTER TABLE public.billing_settings DROP CONSTRAINT ' ||
                (SELECT constraint_name FROM information_schema.table_constraints
                 WHERE constraint_name LIKE '%billing_type_check%'
                 AND table_name = 'billing_settings' LIMIT 1);
    END IF;
END $$;

-- Step 2: Update any existing data to use the new billing_type values
-- Handle the case where billing_type might already be set to valid values
UPDATE public.billing_settings
SET billing_type = CASE
    WHEN billing_type IN ('in-advance', 'right-after', 'monthly') THEN billing_type  -- Keep if already valid
    WHEN billing_trigger = 'before_consultation' THEN 'in-advance'
    WHEN billing_trigger = 'after_consultation' THEN 'right-after'
    WHEN billing_frequency = 'monthly' THEN 'monthly'
    WHEN billing_type = 'consultation_based' THEN 'right-after'  -- Map old value
    WHEN billing_type = 'recurring' AND billing_frequency = 'monthly' THEN 'monthly'
    ELSE 'in-advance'  -- default fallback
END;

-- Step 3: Drop the columns we no longer need
ALTER TABLE public.billing_settings
DROP COLUMN IF EXISTS should_bill,
DROP COLUMN IF EXISTS billing_frequency,
DROP COLUMN IF EXISTS billing_trigger,
DROP COLUMN IF EXISTS billing_advance_days;

-- Add currency column for future use
ALTER TABLE public.billing_settings
ADD COLUMN currency TEXT DEFAULT 'EUR' NOT NULL;

-- Step 4: Add the new constraint for our three billing types
ALTER TABLE public.billing_settings
ADD CONSTRAINT billing_settings_billing_type_check
CHECK (billing_type IN ('in-advance', 'right-after', 'monthly'));

-- Step 5: Update column to be NOT NULL since it's required
ALTER TABLE public.billing_settings
ALTER COLUMN billing_type SET NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN public.billing_settings.billing_type IS 'Billing timing: in-advance (payment required when booking), right-after (bill after consultation), monthly (monthly billing)';
COMMENT ON COLUMN public.billing_settings.billing_amount IS 'Amount to charge for this billing configuration';
COMMENT ON COLUMN public.billing_settings.currency IS 'Currency code (e.g., EUR, USD)';

-- Update the table comment
COMMENT ON TABLE public.billing_settings IS 'Billing configurations with three-level hierarchy: user defaults, client overrides, booking specific';
