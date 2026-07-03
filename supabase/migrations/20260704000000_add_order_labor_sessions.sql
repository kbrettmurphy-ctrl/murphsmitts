create table if not exists public.order_labor_sessions (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  phase text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists order_labor_sessions_order_number_idx
  on public.order_labor_sessions (order_number);

create index if not exists order_labor_sessions_started_at_idx
  on public.order_labor_sessions (started_at);