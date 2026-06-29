-- ============================================================
--  PKN MILK DISTRIBUTION — SUPABASE SCHEMA
--  Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES (linked to auth.users) ──────────────────────────
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  full_name   text,
  role        text not null default 'helper' check (role in ('admin', 'helper')),
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'helper')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── RETAILERS ────────────────────────────────────────────────
create table public.retailers (
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

-- All authenticated users can read retailers
create policy "Auth users read retailers"
  on public.retailers for select using (auth.role() = 'authenticated');

-- All authenticated users can insert retailers
create policy "Auth users insert retailers"
  on public.retailers for insert with check (auth.role() = 'authenticated');

-- All authenticated users can update retailers
create policy "Auth users update retailers"
  on public.retailers for update using (auth.role() = 'authenticated');

-- Only admin can delete retailers
create policy "Auth users delete retailers"
  on public.retailers for delete using (auth.role() = 'authenticated');


-- ── PRODUCTS ─────────────────────────────────────────────────
create table public.products (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  unit        text not null default 'Litre',
  rate        numeric(10,2) not null,
  is_active   boolean default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.products enable row level security;

create policy "Auth users read products"
  on public.products for select using (auth.role() = 'authenticated');

create policy "Auth users insert products"
  on public.products for insert with check (auth.role() = 'authenticated');

create policy "Auth users update products"
  on public.products for update using (auth.role() = 'authenticated');

create policy "Auth users delete products"
  on public.products for delete using (auth.role() = 'authenticated');


-- ── ORDERS ───────────────────────────────────────────────────
create table public.orders (
  id           uuid default uuid_generate_v4() primary key,
  retailer_id  uuid references public.retailers(id) on delete set null,
  order_date   date not null default current_date,
  total        numeric(10,2) not null default 0,
  notes        text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now()
);

alter table public.orders enable row level security;

create policy "Auth users read orders"
  on public.orders for select using (auth.role() = 'authenticated');

create policy "Auth users insert orders"
  on public.orders for insert with check (auth.role() = 'authenticated');

create policy "Auth users update orders"
  on public.orders for update using (auth.role() = 'authenticated');

create policy "Auth users delete orders"
  on public.orders for delete using (auth.role() = 'authenticated');


-- ── ORDER ITEMS ──────────────────────────────────────────────
create table public.order_items (
  id          uuid default uuid_generate_v4() primary key,
  order_id    uuid references public.orders(id) on delete cascade not null,
  product_id  uuid references public.products(id) on delete set null,
  product_name text not null,
  unit        text not null,
  rate        numeric(10,2) not null,
  quantity    numeric(10,2) not null,
  amount      numeric(10,2) not null
);

alter table public.order_items enable row level security;

create policy "Auth users read order_items"
  on public.order_items for select using (auth.role() = 'authenticated');

create policy "Auth users insert order_items"
  on public.order_items for insert with check (auth.role() = 'authenticated');

create policy "Auth users delete order_items"
  on public.order_items for delete using (auth.role() = 'authenticated');


-- ── SEED DEFAULT PRODUCTS ────────────────────────────────────
insert into public.products (name, unit, rate) values
  ('Full Cream Milk',      'Litre',  60),
  ('Toned Milk',           'Litre',  52),
  ('Double Toned Milk',    'Litre',  48),
  ('Butter Milk',          'Litre',  20),
  ('Curd',                 'Kg',     70),
  ('Paneer',               'Kg',    320),
  ('Ghee',                 'Kg',    580);


-- ── UPDATED_AT TRIGGER ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger retailers_updated_at before update on public.retailers
  for each row execute procedure public.set_updated_at();

create trigger products_updated_at before update on public.products
  for each row execute procedure public.set_updated_at();
