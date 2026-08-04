-- MurphOS v1.4.2: Reliable Intake
--
-- Creates public intake orders in one transaction, serializes order-number
-- allocation, and records idempotency keys so client retries cannot create
-- duplicate orders. Notification delivery remains outside the database
-- transaction; the Function records its explicit delivery result afterward.

create table if not exists public.intake_submissions (
  idempotency_key text primary key,
  request_hash text not null,
  order_ids uuid[] not null default '{}'::uuid[],
  notification_result jsonb,
  notifications_completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint intake_submissions_key_length
    check (char_length(idempotency_key) between 16 and 128),
  constraint intake_submissions_hash_format
    check (request_hash ~ '^[0-9a-f]{64}$')
);

alter table public.intake_submissions enable row level security;

create or replace function public.create_intake_orders(
  p_idempotency_key text,
  p_request_hash text,
  p_orders jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := lower(trim(coalesce(p_request_hash, '')));
  v_submission public.intake_submissions%rowtype;
  v_inserted public.orders%rowtype;
  v_order jsonb;
  v_orders jsonb := '[]'::jsonb;
  v_order_ids uuid[] := '{}'::uuid[];
  v_next_number bigint;
  v_order_number text;
  v_index integer := 0;
begin
  if char_length(v_key) < 16 or char_length(v_key) > 128 then
    return jsonb_build_object('ok', false, 'error', 'Invalid intake idempotency key.');
  end if;
  if v_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'Invalid intake request hash.');
  end if;
  if p_orders is null or jsonb_typeof(p_orders) <> 'array' or jsonb_array_length(p_orders) < 1 then
    return jsonb_build_object('ok', false, 'error', 'At least one glove is required.');
  end if;

  -- One transaction lock covers both the idempotency decision and allocation.
  -- Concurrent intake requests therefore receive disjoint number ranges.
  perform pg_advisory_xact_lock(hashtextextended('murphos_intake_order_numbers', 0));

  select * into v_submission
  from public.intake_submissions
  where idempotency_key = v_key
  for update;

  if found then
    if v_submission.request_hash <> v_hash then
      return jsonb_build_object(
        'ok', false,
        'error', 'This intake retry key was already used for different request data.',
        'conflict', 'idempotency_key_reused'
      );
    end if;

    select coalesce(
      jsonb_agg(to_jsonb(o) order by array_position(v_submission.order_ids, o.id)),
      '[]'::jsonb
    ) into v_orders
    from public.orders o
    where o.id = any(v_submission.order_ids);

    if jsonb_array_length(v_orders) <> cardinality(v_submission.order_ids) then
      return jsonb_build_object(
        'ok', false,
        'error', 'The original intake exists, but one or more orders are unavailable.',
        'conflict', 'idempotency_orders_missing'
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'orders', v_orders,
      'notificationResult', v_submission.notification_result
    );
  end if;

  select greatest(
    79::bigint,
    coalesce(max(case
      when trim(order_number) ~ '^[0-9]+$' then trim(order_number)::bigint
      else null
    end), 79::bigint)
  ) + 1
  into v_next_number
  from public.orders;

  for v_order in select value from jsonb_array_elements(p_orders)
  loop
    v_order_number := case
      when v_next_number + v_index < 10000
        then lpad((v_next_number + v_index)::text, 4, '0')
      else (v_next_number + v_index)::text
    end;

    insert into public.orders (
      timestamp_submitted, tracking_token,
      customer_name, phone_number, email_address,
      brand_model, glove_type, web_type, services_requested,
      primary_lace_color, secondary_lace_color, custom_color_request,
      drop_off_method, street_address, city, state, zip_code,
      glove_notes, customer_notes, social_tag, turnaround_acknowledged,
      referral_source, glove_photos, order_number, status,
      date_received, estimated_completion, price_quoted, paid,
      allow_ship_without_payment, tracking_number, carrier, date_completed,
      internal_notes, last_status_emailed, sms_opt_in, last_status_texted
    ) values (
      nullif(v_order->>'timestamp_submitted', '')::timestamptz,
      nullif(v_order->>'tracking_token', ''),
      nullif(v_order->>'customer_name', ''),
      nullif(v_order->>'phone_number', ''),
      nullif(v_order->>'email_address', ''),
      nullif(v_order->>'brand_model', ''),
      nullif(v_order->>'glove_type', ''),
      nullif(v_order->>'web_type', ''),
      nullif(v_order->>'services_requested', ''),
      nullif(v_order->>'primary_lace_color', ''),
      nullif(v_order->>'secondary_lace_color', ''),
      nullif(v_order->>'custom_color_request', ''),
      nullif(v_order->>'drop_off_method', ''),
      nullif(v_order->>'street_address', ''),
      nullif(v_order->>'city', ''),
      nullif(v_order->>'state', ''),
      nullif(v_order->>'zip_code', ''),
      nullif(v_order->>'glove_notes', ''),
      nullif(v_order->>'customer_notes', ''),
      nullif(v_order->>'social_tag', ''),
      nullif(v_order->>'turnaround_acknowledged', ''),
      nullif(v_order->>'referral_source', ''),
      coalesce(v_order->'glove_photos', '[]'::jsonb),
      v_order_number,
      coalesce(nullif(v_order->>'status', ''), 'Received'),
      nullif(v_order->>'date_received', '')::date,
      nullif(v_order->>'estimated_completion', '')::date,
      nullif(v_order->>'price_quoted', '')::numeric,
      coalesce(nullif(v_order->>'paid', ''), 'Unpaid'),
      coalesce((v_order->>'allow_ship_without_payment')::boolean, false),
      nullif(v_order->>'tracking_number', ''),
      nullif(v_order->>'carrier', ''),
      nullif(v_order->>'date_completed', '')::date,
      nullif(v_order->>'internal_notes', ''),
      nullif(v_order->>'last_status_emailed', ''),
      coalesce((v_order->>'sms_opt_in')::boolean, false),
      nullif(v_order->>'last_status_texted', '')
    ) returning * into v_inserted;

    v_order_ids := array_append(v_order_ids, v_inserted.id);
    v_orders := v_orders || jsonb_build_array(to_jsonb(v_inserted));
    v_index := v_index + 1;
  end loop;

  insert into public.intake_submissions (idempotency_key, request_hash, order_ids)
  values (v_key, v_hash, v_order_ids);

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'orders', v_orders,
    'notificationResult', null
  );
exception when unique_violation then
  return jsonb_build_object(
    'ok', false,
    'error', 'Order creation conflicted with another request. Retry with the same intake key.',
    'conflict', 'order_number_conflict',
    'retryable', true
  );
end $$;
