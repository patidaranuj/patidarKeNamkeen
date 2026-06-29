-- ============================================================
--  PKN MILK DISTRIBUTION — SUPABASE SCHEMA v2
--  Run this ENTIRE file in Supabase SQL Editor (fresh project)
--  OR run only the "ADD TO EXISTING" section if upgrading
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── PROFILES ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  full_name   text,
  role        text not null default 'helper' check (role in ('admin', 'helper')),
  created_at  timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), coalesce(new.raw_user_meta_data->>'role', 'helper'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── RETAILERS ────────────────────────────────────────────────
create table if not exists public.retailers (
  id           uuid default uuid_generate_v4() primary key,
  name         text not null,
  owner_name   text,
  phone        text,
  area         text,
  address      text,
  gstin        text,
  credit_limit numeric(10,2) default 0,
  is_active    boolean default true,
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.retailers enable row level security;
create policy "Auth users read retailers" on public.retailers for select using (auth.role() = 'authenticated');
create policy "Auth users insert retailers" on public.retailers for insert with check (auth.role() = 'authenticated');
create policy "Auth users update retailers" on public.retailers for update using (auth.role() = 'authenticated');
create policy "Auth users delete retailers" on public.retailers for delete using (auth.role() = 'authenticated');


-- ── PRODUCT CATEGORIES ───────────────────────────────────────
create table if not exists public.product_categories (
  id         uuid default uuid_generate_v4() primary key,
  name       text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table public.product_categories enable row level security;
create policy "Auth users read categories" on public.product_categories for select using (auth.role() = 'authenticated');
create policy "Auth users manage categories" on public.product_categories for all using (auth.role() = 'authenticated');


-- ── PRODUCTS (parent — just the name/category) ───────────────
create table if not exists public.products (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  category_id uuid references public.product_categories(id) on delete set null,
  is_active   boolean default true,
  sort_order  int default 0,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.products enable row level security;
create policy "Auth users read products" on public.products for select using (auth.role() = 'authenticated');
create policy "Auth users manage products" on public.products for all using (auth.role() = 'authenticated');


-- ── PRODUCT VARIANTS (size/weight/pack per product) ──────────
create table if not exists public.product_variants (
  id           uuid default uuid_generate_v4() primary key,
  product_id   uuid references public.products(id) on delete cascade not null,
  variant_name text not null,          -- e.g. "1 Litre", "500ml", "6 Litre Pack"
  unit         text not null default 'piece',
  retailer_rate numeric(10,2) not null, -- what you charge retailers
  mrp           numeric(10,2),          -- printed MRP / customer rate
  is_active    boolean default true,
  sort_order   int default 0,
  created_at   timestamptz default now()
);
alter table public.product_variants enable row level security;
create policy "Auth users read variants" on public.product_variants for select using (auth.role() = 'authenticated');
create policy "Auth users manage variants" on public.product_variants for all using (auth.role() = 'authenticated');


-- ── ORDERS ───────────────────────────────────────────────────
create table if not exists public.orders (
  id           uuid default uuid_generate_v4() primary key,
  retailer_id  uuid references public.retailers(id) on delete set null,
  order_date   date not null default current_date,
  slot         text not null default 'morning' check (slot in ('morning','evening')),
  total        numeric(10,2) not null default 0,
  notes        text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now()
);
alter table public.orders enable row level security;
create policy "Auth users read orders" on public.orders for select using (auth.role() = 'authenticated');
create policy "Auth users manage orders" on public.orders for all using (auth.role() = 'authenticated');


-- ── ORDER ITEMS ──────────────────────────────────────────────
create table if not exists public.order_items (
  id           uuid default uuid_generate_v4() primary key,
  order_id     uuid references public.orders(id) on delete cascade not null,
  variant_id   uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text not null,
  unit         text not null,
  rate         numeric(10,2) not null,
  quantity     numeric(10,2) not null,
  amount       numeric(10,2) not null
);
alter table public.order_items enable row level security;
create policy "Auth users read order_items" on public.order_items for select using (auth.role() = 'authenticated');
create policy "Auth users manage order_items" on public.order_items for all using (auth.role() = 'authenticated');


-- ── UPDATED_AT TRIGGER ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists retailers_updated_at on public.retailers;
create trigger retailers_updated_at before update on public.retailers
  for each row execute procedure public.set_updated_at();

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute procedure public.set_updated_at();


-- ══════════════════════════════════════════════════════════════
--  SEED DATA — Categories & Products from your price list
-- ══════════════════════════════════════════════════════════════

-- Categories
insert into public.product_categories (name, sort_order) values
  ('दूध (Milk)', 1),
  ('दही / पनीर (Curd / Paneer)', 2),
  ('घी / मक्खन (Ghee / Butter)', 3),
  ('मिठाई / स्वीट्स (Sweets)', 4),
  ('अन्य (Others)', 5)
on conflict do nothing;

-- Products & Variants — Milk
with cat as (select id from public.product_categories where name='दूध (Milk)' limit 1)
insert into public.products (name, category_id, sort_order) select name, (select id from cat), n from (values
  ('हाईफेट / गोल्ड', 1),
  ('स्टेंडर्ड / शक्ति', 2),
  ('साँची गाय का दूध', 3),
  ('टी.एम. / ताजा', 4),
  ('डी.टी.एम. / स्मार्ट', 5),
  ('चाय दूध', 6),
  ('परिवार दूध', 7),
  ('चाय स्पेशल दूध', 8)
) as t(name,n)
on conflict do nothing;

-- Variants for हाईफेट / गोल्ड
insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('6 लीटर पैक','pack',396.00,414.00,1),('1 लीटर','litre',67.00,70.00,2),('500 एमएल','ml',33.50,35.00,3)) as v(vname,unit,rrate,mrp,s)
where p.name='हाईफेट / गोल्ड' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('6 लीटर पैक','pack',360.00,378.00,1),('1 लीटर','litre',60.00,63.00,2),('500 एमएल','ml',30.50,32.00,3)) as v(vname,unit,rrate,mrp,s)
where p.name='स्टेंडर्ड / शक्ति' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('500 एमएल','ml',29.50,31.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='साँची गाय का दूध' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('6 लीटर','pack',324.00,342.00,1),('1 लीटर','litre',54.00,57.00,2),('500 एमएल','ml',27.50,29.00,3)) as v(vname,unit,rrate,mrp,s)
where p.name='टी.एम. / ताजा' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('500 एमएल','ml',25.50,27.00,1),('200 एमएल','ml',9.00,10.00,2)) as v(vname,unit,rrate,mrp,s)
where p.name='डी.टी.एम. / स्मार्ट' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('1 लीटर','litre',59.00,62.00,1),('500 एमएल','ml',22.50,24.00,2)) as v(vname,unit,rrate,mrp,s)
where p.name='चाय दूध' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('500 एमएल','ml',7.00,10.00,1),('200 एमएल','ml',7.00,10.00,2)) as v(vname,unit,rrate,mrp,s)
where p.name='परिवार दूध' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('1 लीटर','litre',53.00,56.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='चाय स्पेशल दूध' on conflict do nothing;


-- Products & Variants — Curd/Paneer
with cat as (select id from public.product_categories where name='दही / पनीर (Curd / Paneer)' limit 1)
insert into public.products (name, category_id, sort_order) select name, (select id from cat), n from (values
  ('दही',1),('पनीर',2),('मावा',3),('श्रीखण्ड',4),('मीठा दही',5),('छेना रबड़ी',6)
) as t(name,n) on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('100 ग्राम','gm',10.00,12.00,1),('500 ग्राम','gm',36.50,40.00,2),('5 किग्रा','kg',390.00,425.00,3)) as v(vname,unit,rrate,mrp,s)
where p.name='दही' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('200 ग्राम','gm',80.00,90.00,1),('500 ग्राम','gm',174.00,188.00,2),('1 किग्रा','kg',360.00,400.00,3),('5 किग्रा','kg',1600.00,1650.00,4)) as v(vname,unit,rrate,mrp,s)
where p.name='पनीर' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('500 ग्राम','gm',188.00,200.00,1),('5 किग्रा','kg',1625.00,1700.00,2)) as v(vname,unit,rrate,mrp,s)
where p.name='मावा' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('100 ग्राम','gm',26.00,30.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='श्रीखण्ड' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('100 ग्राम','gm',12.75,15.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='मीठा दही' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('100 ग्राम','gm',28.00,33.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='छेना रबड़ी' on conflict do nothing;


-- Products & Variants — Ghee/Butter
with cat as (select id from public.product_categories where name='घी / मक्खन (Ghee / Butter)' limit 1)
insert into public.products (name, category_id, sort_order) select name, (select id from cat), n from (values
  ('साँची घी',1),('टेबल बटर',2),('मक्खन मथरा',3),('सादा मथरा',4)
) as t(name,n) on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('200 एमएल','ml',121.11,130.00,1),('300 एमएल','ml',296.54,315.00,2),('1 लीटर','litre',585.59,620.00,3),('5 लीटर जार','jar',2940.28,3000.00,4),('15 किग्रा पाक','pack',9786.00,10500.00,5)) as v(vname,unit,rrate,mrp,s)
where p.name='साँची घी' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('500 ग्राम','gm',270.00,300.00,1),('10 ग्राम (250 पैक)','pack',135.00,150.00,2),('20 ग्राम (200 पैक)','pack',135.00,150.00,3)) as v(vname,unit,rrate,mrp,s)
where p.name='टेबल बटर' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('200 एमएल','ml',8.00,10.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='मक्खन मथरा' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('500 एमएल','ml',13.00,15.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='सादा मथरा' on conflict do nothing;


-- Products & Variants — Sweets
with cat as (select id from public.product_categories where name='मिठाई / स्वीट्स (Sweets)' limit 1)
insert into public.products (name, category_id, sort_order) select name, (select id from cat), n from (values
  ('साँची पेड़ा',1),('मिल्ककेक',2),('रसगुल्ला',3),('गुलाब जामुन',4),('आइसखण्ड',5),('स्टे फ्लेवर्ड मिल्क बॉटल',6)
) as t(name,n) on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('250 ग्राम','gm',165.00,115.00,1),('500 ग्राम','gm',205.00,225.00,2),('1 किग्रा','kg',388.00,430.00,3)) as v(vname,unit,rrate,mrp,s)
where p.name='साँची पेड़ा' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('35 ग्राम (2 नग)','piece',13.00,15.00,1),('250 ग्राम','gm',115.00,125.00,2)) as v(vname,unit,rrate,mrp,s)
where p.name='मिल्ककेक' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('500 ग्राम','gm',233.00,250.00,1),('1 किग्रा','kg',191.00,210.00,2)) as v(vname,unit,rrate,mrp,s)
where p.name='रसगुल्ला' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('500 ग्राम','gm',109.00,120.00,1),('1 किग्रा','kg',209.00,230.00,2)) as v(vname,unit,rrate,mrp,s)
where p.name='गुलाब जामुन' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('90 ग्राम','gm',26.00,30.00,1),('400 ग्राम','gm',125.00,145.00,2)) as v(vname,unit,rrate,mrp,s)
where p.name='आइसखण्ड' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('200 एमएल','ml',26.00,30.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='स्टे फ्लेवर्ड मिल्क बॉटल' on conflict do nothing;


-- Products & Variants — Others
with cat as (select id from public.product_categories where name='अन्य (Others)' limit 1)
insert into public.products (name, category_id, sort_order) select name, (select id from cat), n from (values
  ('लस्सी',1),('कोल्ड कॉफी',2),('बटर कुकीज',3),('जीरा कुकीज',4),('चॉकलेट कुकीज',5),('कोकोनट कुकीज',6)
) as t(name,n) on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('200 एमएल','ml',26.00,30.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='लस्सी' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('200 एमएल','ml',31.00,33.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='कोल्ड कॉफी' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('75 ग्राम','gm',16.61,18.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='बटर कुकीज' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('75 ग्राम','gm',16.61,18.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='जीरा कुकीज' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('75 ग्राम','gm',16.61,18.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='चॉकलेट कुकीज' on conflict do nothing;

insert into public.product_variants (product_id, variant_name, unit, retailer_rate, mrp, sort_order)
select p.id, v.vname, v.unit, v.rrate, v.mrp, v.s from public.products p,
(values ('75 ग्राम','gm',16.61,18.00,1)) as v(vname,unit,rrate,mrp,s)
where p.name='कोकोनट कुकीज' on conflict do nothing;
