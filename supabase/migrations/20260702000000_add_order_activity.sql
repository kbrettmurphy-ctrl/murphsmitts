create table if not exists public.order_activity (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  event_type text not null,
  event_label text not null,
  event_detail text null,
  actor text null default 'admin',
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists order_activity_order_number_created_at_idx
  on public.order_activity (order_number, created_at desc);

create index if not exists order_activity_event_type_idx
  on public.order_activity (event_type);
