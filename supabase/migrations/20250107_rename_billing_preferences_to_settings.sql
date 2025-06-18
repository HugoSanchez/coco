-- Rename billing_preferences table to billing_settings
-- Simple rename, no complex changes

ALTER TABLE public.billing_preferences RENAME TO billing_settings;

-- Update RLS policy names to match new table name
DROP POLICY IF EXISTS "Users can view their own billing preferences" ON public.billing_settings;
DROP POLICY IF EXISTS "Users can manage their own billing preferences" ON public.billing_settings;

CREATE POLICY "Users can manage their own billing settings"
ON public.billing_settings
FOR ALL
USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.billing_settings IS 'User billing settings (renamed from billing_preferences)';
