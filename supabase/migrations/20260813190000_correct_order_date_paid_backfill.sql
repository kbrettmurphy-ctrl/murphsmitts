-- A currently paid order can have more than one Unpaid -> Paid transition.
-- The latest transition represents the current payment period; using the
-- earliest can incorrectly move revenue into an older reporting period.
update public.orders o
set date_paid = paid_activity.latest_paid_at
from (
  select order_number, max(created_at) as latest_paid_at
  from public.order_activity
  where event_type = 'paid_changed'
    and event_detail ~* '(^|[[:space:]])(unpaid|blank)[[:space:]]*->[[:space:]]*paid$'
  group by order_number
) paid_activity
where paid_activity.order_number = o.order_number
  and lower(trim(coalesce(o.paid, ''))) = 'paid'
  and o.date_paid is distinct from paid_activity.latest_paid_at;
