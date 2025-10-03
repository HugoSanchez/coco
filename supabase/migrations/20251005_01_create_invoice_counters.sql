-- invoice_counters: next_number per (user_id, series=YYYY-MM)

CREATE TABLE IF NOT EXISTS public.invoice_counters (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    series TEXT NOT NULL,
    next_number INT NOT NULL,
    PRIMARY KEY (user_id, series)
);

-- Helper function to initialize counter if missing
CREATE OR REPLACE FUNCTION public.ensure_invoice_counter(u UUID, s TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.invoice_counters(user_id, series, next_number)
  VALUES (u, s, 1)
  ON CONFLICT (user_id, series) DO NOTHING;
END;$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.invoice_counters IS 'Atomic counters for monthly series numbering.';

-- RLS: Only owner can see their counters
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can select own invoice_counters" ON public.invoice_counters;
CREATE POLICY "Users can select own invoice_counters" ON public.invoice_counters
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own invoice_counters" ON public.invoice_counters;
CREATE POLICY "Users can insert own invoice_counters" ON public.invoice_counters
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own invoice_counters" ON public.invoice_counters;
CREATE POLICY "Users can update own invoice_counters" ON public.invoice_counters
    FOR UPDATE USING (auth.uid() = user_id);

