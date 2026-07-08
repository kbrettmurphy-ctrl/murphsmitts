create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  label text null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz null
);
