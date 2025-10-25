-- Add meeting duration columns to billing_settings
-- These durations work alongside billing amounts to define consultation settings
-- - meeting_duration_min: Default duration for regular/follow-up consultations
-- - first_meeting_duration_min: Optional duration for first consultations

ALTER TABLE public.billing_settings
ADD COLUMN meeting_duration_min INTEGER DEFAULT 60,
ADD COLUMN first_meeting_duration_min INTEGER;

-- Add helpful comments
COMMENT ON COLUMN public.billing_settings.meeting_duration_min IS 'Duration in minutes for regular consultations (default 60)';
COMMENT ON COLUMN public.billing_settings.first_meeting_duration_min IS 'Duration in minutes for first consultations (optional, null uses meeting_duration_min)';

