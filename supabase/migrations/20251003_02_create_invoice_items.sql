-- invoice_items: composable lines; optional link to bookings

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,

    description TEXT NOT NULL,
    qty NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,       -- excl. tax
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_booking_id ON public.invoice_items(booking_id);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Inherit ownership via parent invoice
DROP POLICY IF EXISTS "Users can select own invoice_items" ON public.invoice_items;
CREATE POLICY "Users can select own invoice_items" ON public.invoice_items
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own invoice_items" ON public.invoice_items;
CREATE POLICY "Users can insert own invoice_items" ON public.invoice_items
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own invoice_items" ON public.invoice_items;
CREATE POLICY "Users can update own invoice_items" ON public.invoice_items
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.update_invoice_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_invoice_items_updated_at ON public.invoice_items;
CREATE TRIGGER trg_update_invoice_items_updated_at
BEFORE UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.update_invoice_items_updated_at();

COMMENT ON TABLE public.invoice_items IS 'Invoice lines. One booking → one line for per‑booking billing; monthly invoices contain many lines.';

