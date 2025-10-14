-- Drop deprecated invoice_items table and dependent objects
-- Safe to run multiple times; guarded with IF EXISTS

begin;

-- Drop table (cascades FKs, indexes, constraints on this table)
drop table if exists public.invoice_items cascade;

commit;


