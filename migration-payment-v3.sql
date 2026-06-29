-- ============================================================
--  MIGRATION: Payment status + English name support
--  Run this in Supabase SQL Editor (safe to run on existing DB)
-- ============================================================

-- Add english_name to products (for PDF rendering)
alter table public.products 
  add column if not exists english_name text;

-- Add english_name to product_variants (for PDF rendering)
alter table public.product_variants 
  add column if not exists english_variant_name text;

-- Add payment fields to orders
alter table public.orders
  add column if not exists payment_status text not null default 'unpaid' 
    check (payment_status in ('paid', 'unpaid', 'partial')),
  add column if not exists amount_paid numeric(10,2) not null default 0,
  add column if not exists amount_pending numeric(10,2) generated always as (total - amount_paid) stored;

-- Update existing orders to have correct pending amount
-- (amount_pending is auto-calculated as total - amount_paid)

-- View: retailer payment summary
create or replace view public.retailer_payment_summary as
select 
  r.id as retailer_id,
  r.name as retailer_name,
  r.phone,
  r.area,
  count(o.id) as total_orders,
  coalesce(sum(o.total), 0) as total_billed,
  coalesce(sum(o.amount_paid), 0) as total_paid,
  coalesce(sum(o.total - o.amount_paid), 0) as total_pending
from public.retailers r
left join public.orders o on o.retailer_id = r.id
group by r.id, r.name, r.phone, r.area;

-- Grant access to the view
grant select on public.retailer_payment_summary to authenticated;

select 'Migration complete!' as status;
