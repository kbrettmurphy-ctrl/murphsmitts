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

-- Backfill from the last inbound text already stored on each order, so the
-- inbox isn't empty on day one. Marked read (historical). Guarded so a rerun
-- can't duplicate.
insert into public.sms_messages (direction, phone_number, customer_name, order_number, body, read, created_at)
select 'in', o.phone_number, o.customer_name, o.order_number, o.last_customer_text, true,
       coalesce(o.last_customer_text_at, o.updated_at, now())
from public.orders o
where o.phone_number is not null
  and o.last_customer_text is not null
  and length(trim(o.last_customer_text)) > 0
  and not exists (
    select 1 from public.sms_messages m
    where m.order_number = o.order_number
      and m.direction = 'in'
      and m.body = o.last_customer_text
  );
