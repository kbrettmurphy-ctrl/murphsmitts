-- Record when payment was received so cash revenue is reported by payment
-- date instead of workflow completion date.
alter table public.orders
  add column if not exists date_paid timestamptz;

-- Prefer the first structured Paid change in the audit trail. Older paid
-- orders without that event fall back to completion, then the best available
-- order timestamp so every existing payment remains reportable.
update public.orders o
set date_paid = coalesce(
  (
    select min(a.created_at)
    from public.order_activity a
    where a.order_number = o.order_number
      and a.event_type = 'paid_changed'
      and a.event_detail ~* '(^|[[:space:]])(unpaid|blank)[[:space:]]*->[[:space:]]*paid$'
  ),
  o.date_completed::timestamp at time zone 'America/New_York',
  o.updated_at,
  o.created_at,
  o.timestamp_submitted
)
where lower(trim(coalesce(o.paid, ''))) = 'paid'
  and o.date_paid is null;

create index if not exists orders_date_paid_idx
  on public.orders (date_paid)
  where date_paid is not null;
