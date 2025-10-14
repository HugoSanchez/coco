-- Migration: Remove bill-level receipts and add helpful invoice indexes
-- Purpose:
--  - Keep receipts only on invoices (document shell)
--  - Backfill invoice.stripe_receipt_url from any linked bill before dropping
--  - Ensure bills.due_date is absent (idempotent drop)
--  - Add a couple of indexes to speed up lookups by period/numbering

begin;

-- 1) Backfill invoice receipt from bills when linked and invoice missing a receipt
update public.invoices i
set stripe_receipt_url = b.stripe_receipt_url
from public.bills b
where b.invoice_id = i.id
  and b.stripe_receipt_url is not null
  and (i.stripe_receipt_url is null or i.stripe_receipt_url = '');

-- 2) Drop bill-level receipt columns (single source of truth lives on invoices)
alter table public.bills drop column if exists stripe_receipt_url;
alter table public.bills drop column if exists stripe_charge_id;
alter table public.bills drop column if exists stripe_receipt_email_sent_at;

-- 3) Ensure due_date no longer exists on bills (idempotent)
alter table public.bills drop column if exists due_date;

-- 4) Add refund linkage from bills -> credit note invoices (idempotent)
alter table public.bills
  add column if not exists refund_invoice_id uuid null references public.invoices(id) on delete set null;

create index if not exists bills_refund_invoice_id_idx on public.bills (refund_invoice_id);

-- 5) Helpful indexes on invoices
create index if not exists invoices_period_idx on public.invoices (billing_period_start, billing_period_end);
create index if not exists invoices_series_number_idx on public.invoices (series, number);

commit;


