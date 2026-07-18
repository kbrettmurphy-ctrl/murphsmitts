-- Expenses module (2.4): manual shop expenses -> true profit after expenses,
-- and dynamic per-unit costs. A purchase with unit_kind + quantity teaches
-- the economics its real unit cost (amount / quantity); latest purchase wins.
create table if not exists public.shop_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null,
  description text,
  amount numeric not null,
  quantity numeric,
  unit_kind text,
  created_at timestamptz not null default now()
);

create index if not exists shop_expenses_date_idx
  on public.shop_expenses (expense_date desc);
