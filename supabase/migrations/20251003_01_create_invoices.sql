-- invoices: header-level billing document (monthly series numbering)
-- numbering: unique per (user_id, series, number), where series = 'YYYY-MM'

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,

    -- Lifecycle
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','canceled','refunded','disputed')),
    currency CHAR(3) NOT NULL DEFAULT 'EUR',

    -- Amounts (header totals)
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT invoices_total_check CHECK (ROUND(subtotal + tax_total, 2) = total),

    -- Dates
    due_date TIMESTAMPTZ,
    issued_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,

    -- Numbering (monthly series mandatory)
    series TEXT,                 -- e.g. '2025-10' derived from issued_at
    number INT,                  -- sequential within (user_id, series)
    year SMALLINT,               -- convenience for analytics (mirror issued_at)
    month SMALLINT,              -- convenience for analytics (mirror issued_at)

    -- Document
    pdf_url TEXT,
    pdf_sha256 TEXT,

    -- Snapshots (immutable once issued)
    client_name_snapshot TEXT NOT NULL,
    client_email_snapshot TEXT NOT NULL,

    -- Stripe convenience (canonical IDs live in payment_sessions)
    stripe_receipt_url TEXT,

    -- Billing period (for monthly invoices)
    billing_period_start DATE,
    billing_period_end DATE,

    -- Legacy mapping for safe backfill/rollback
    legacy_bill_id UUID,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique numbering per user+series when number is set
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_number
    ON public.invoices(user_id, series, number)
    WHERE number IS NOT NULL;

-- Common indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON public.invoices(issued_at);

-- RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Users can see/manage only their invoices
DROP POLICY IF EXISTS "Users can select own invoices" ON public.invoices;
CREATE POLICY "Users can select own invoices" ON public.invoices
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;
CREATE POLICY "Users can insert own invoices" ON public.invoices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own invoices" ON public.invoices;
CREATE POLICY "Users can update own invoices" ON public.invoices
    FOR UPDATE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_invoices_updated_at();

COMMENT ON TABLE public.invoices IS 'Invoices with monthly series numbering (series=YYYY-MM).';

