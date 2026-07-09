create table if not exists public.gallery_photo_links (
  id uuid primary key default gen_random_uuid(),
  photo_url text not null unique,
  photo_path text null,
  order_number text not null,
  created_at timestamptz not null default now()
);

create index if not exists gallery_photo_links_order_idx
  on public.gallery_photo_links (order_number);
