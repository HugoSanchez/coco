-- Add invoice_id linkage to payment_sessions (keeps booking_id for legacy)

ALTER TABLE public.payment_sessions
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_sessions_invoice_id ON public.payment_sessions(invoice_id);

COMMENT ON COLUMN public.payment_sessions.invoice_id IS 'Links a payment session to an invoice. Stripe refs remain here.';

