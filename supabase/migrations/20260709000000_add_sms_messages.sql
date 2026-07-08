create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  direction text not null default 'in',
  phone_number text not null,
  customer_name text null,
  order_number text null,
  body text null,
  media_urls jsonb null,
  twilio_sid text null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sms_messages_phone_created_idx
  on public.sms_messages (phone_number, created_at desc);

create index if not exists sms_messages_read_idx
  on public.sms_messages (read);
