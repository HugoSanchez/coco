-- Migration: Simplify bills model and drop due_date
-- Purpose:
--  - Normalize billing_type to {per_booking, monthly}
--  - Introduce scheduled state via data backfill rules
--  - Add linkage from bills -> invoices (invoice_id)
--  - Add minimal tax fields on bills (defaults to 0)
--  - Drop bills.due_date (selection will use booking start_time for monthly, and email_scheduled_at for per-booking)
--  - Add helpful indexes for cron and lookups

begin;

-- 1) Schema changes: add invoice_id and tax fields
alter table public.bills
  add column if not exists invoice_id uuid null references public.invoices(id) on delete set null;

alter table public.bills
  add column if not exists tax_rate_percent numeric(5,2) not null default 0;

alter table public.bills
  add column if not exists tax_amount numeric(12,2) not null default 0;

-- 2) Normalize billing_type to two values
-- 2a) Relax constraint to allow old and new values during transition
alter table public.bills drop constraint if exists bills_billing_type_check;
alter table public.bills add constraint bills_billing_type_check
  check (billing_type in ('in-advance','right-after','monthly','per_booking'));

-- 2b) Normalize existing rows to the new value
update public.bills
  set billing_type = 'per_booking'
  where billing_type in ('in-advance', 'right-after');

-- 2c) Tighten constraint to final allowed set
alter table public.bills drop constraint if exists bills_billing_type_check;
alter table public.bills add constraint bills_billing_type_check
  check (billing_type in ('per_booking','monthly'));

-- 3) Backfill "scheduled" status where appropriate
-- 3a0) Ensure status constraint allows the new value 'scheduled'
alter table public.bills drop constraint if exists bills_status_check;
alter table public.bills add constraint bills_status_check
  check (status in ('pending','sent','paid','disputed','canceled','refunded','scheduled'));
-- 3a) per_booking: pending + not sent + future scheduled email => scheduled
update public.bills
  set status = 'scheduled'
  where billing_type = 'per_booking'
    and status = 'pending'
    and sent_at is null
    and email_scheduled_at is not null
    and email_scheduled_at > now();

-- 3b) monthly: pending + not sent => scheduled
update public.bills
  set status = 'scheduled'
  where billing_type = 'monthly'
    and status = 'pending'
    and sent_at is null;

-- 4) Drop due_date column (no longer used on bills)
alter table public.bills drop column if exists due_date;

-- 5) Helpful indexes
create index if not exists bills_invoice_id_idx on public.bills (invoice_id);
create index if not exists bills_billing_type_status_idx on public.bills (billing_type, status);
create index if not exists bills_email_scheduled_at_idx on public.bills (email_scheduled_at);

commit;


