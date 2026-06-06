-- ===== Schema สำหรับ Supabase (cloud sync) =====
-- Run this in the Supabase SQL Editor.
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ===== Phase 1 tables =====

create table if not exists products (
	id uuid primary key,
	barcode text,
	name text not null,
	price numeric not null default 0,
	cost numeric,
	stock numeric not null default 0,
	category text,
	unit text,
	is_active int not null default 1,
	updated_at timestamptz default now()
);

create table if not exists sales (
	id uuid primary key,
	created_at timestamptz not null,
	total numeric not null,
	payment_method text not null check (payment_method in ('cash','promptpay')),
	cash_received numeric,
	change numeric,
	-- Phase 2 columns (added below via ALTER — listed here for fresh installs)
	status text not null default 'completed',
	voided_at timestamptz,
	void_reason text
);

create table if not exists sale_items (
	id uuid primary key,
	sale_id uuid not null references sales(id) on delete cascade,
	product_id uuid,
	name text not null,
	price numeric not null,
	qty numeric not null,
	subtotal numeric not null
);

create index if not exists idx_sales_created_at on sales(created_at);
create index if not exists idx_sales_status on sales(status);
create index if not exists idx_sale_items_sale_id on sale_items(sale_id);

-- ===== Phase 2 migrations (safe for existing databases) =====

alter table products add column if not exists min_stock int;
alter table products add column if not exists image_url text;
alter table sales    add column if not exists status text not null default 'completed';
alter table sales    add column if not exists voided_at timestamptz;
alter table sales    add column if not exists void_reason text;

-- Backfill: set status on any existing rows that were inserted before Phase 2
update sales set status = 'completed' where status is null;

-- ===== Phase 3 migrations: Auth + RLS =====
-- Run this after Phase 1 & 2. Safe to re-run.

alter table products   add column if not exists user_id uuid references auth.users(id);
alter table sales      add column if not exists user_id uuid references auth.users(id);
alter table sale_items add column if not exists user_id uuid references auth.users(id);

create index if not exists idx_products_user_id    on products(user_id);
create index if not exists idx_sales_user_id       on sales(user_id);
create index if not exists idx_sale_items_user_id  on sale_items(user_id);
create index if not exists idx_sale_items_product_id on sale_items(product_id);
create index if not exists idx_sales_created_status  on sales(created_at, status);

-- Enable RLS — แต่ละ user เห็นข้อมูลของตัวเองเท่านั้น
alter table products    enable row level security;
alter table sales       enable row level security;
alter table sale_items  enable row level security;

-- Drop old permissive policies if they exist (idempotent re-run safety)
drop policy if exists "own products"  on products;
drop policy if exists "own sales"     on sales;
drop policy if exists "own items"     on sale_items;

create policy "own products" on products
    for all using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "own sales" on sales
    for all using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "own items" on sale_items
    for all using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
