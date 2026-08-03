-- MurphOS v1.3 follow-up: immutable completed-order economics and complete,
-- transactional order deletion. Additive and safe to rerun. Do not apply
-- automatically; this migration is reviewed/applied manually.

alter table public.orders
  add column if not exists economics_snapshot jsonb,
  add column if not exists economics_locked_at timestamptz;

create or replace function public.build_order_economics_snapshot(
  p_order jsonb,
  p_source text default 'completion'
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_order_number text := nullif(trim(p_order->>'order_number'), '');
  v_services text := lower(coalesce(p_order->>'services_requested', ''));
  v_glove_type text := coalesce(p_order->>'glove_type', '');
  v_web_type text := lower(coalesce(p_order->>'web_type', ''));
  v_price numeric := nullif(p_order->>'price_quoted', '')::numeric;
  v_primary_used numeric := greatest(coalesce(nullif(p_order->>'primary_lace_used', '')::numeric, 0), 0);
  v_secondary_used numeric := greatest(coalesce(nullif(p_order->>'secondary_lace_used', '')::numeric, 0), 0);
  v_actual_pieces numeric;
  v_lace_pieces numeric := 0;
  v_lace_source text := 'none';
  v_lace_amount numeric := 0;
  v_lace_quantity numeric := 0;
  v_lace_unit numeric := 3.60;
  v_card_unit numeric := 0.41;
  v_sticker_unit numeric := 0.41;
  v_consumables numeric := 1.00;
  v_consumable_spend numeric := 0;
  v_cleaned_count integer := 0;
  v_lace_cost numeric;
  v_palm_pad numeric := 0;
  v_packaging numeric;
  v_total numeric;
  v_net numeric;
  v_labor_minutes numeric := 0;
  v_phase_minutes jsonb := '{}'::jsonb;
  v_effective_rate numeric;
begin
  if v_order_number is null then
    raise exception 'Order number is required for an economics snapshot.';
  end if;

  select coalesce(sum(duration_minutes), 0)
    into v_labor_minutes
    from public.order_labor_sessions
   where order_number = v_order_number
     and ended_at is not null;
  select coalesce(jsonb_object_agg(phase, minutes), '{}'::jsonb)
    into v_phase_minutes
    from (
      select coalesce(nullif(trim(phase), ''), 'Work') phase,
             coalesce(sum(duration_minutes), 0) minutes
        from public.order_labor_sessions
       where order_number = v_order_number and ended_at is not null
       group by coalesce(nullif(trim(phase), ''), 'Work')
    ) phases;

  select coalesce(sum(amount), 0), coalesce(sum(quantity), 0)
    into v_lace_amount, v_lace_quantity
    from public.shop_expenses
   where unit_kind = 'lace_piece'
     and amount > 0
     and quantity > 0;
  if v_lace_quantity > 0 then
    v_lace_unit := v_lace_amount / v_lace_quantity;
  end if;

  select amount / quantity into v_card_unit
    from public.shop_expenses
   where unit_kind = 'business_card' and amount > 0 and quantity > 0
   order by expense_date desc, created_at desc limit 1;
  v_card_unit := coalesce(v_card_unit, 0.41);

  select amount / quantity into v_sticker_unit
    from public.shop_expenses
   where unit_kind = 'sticker' and amount > 0 and quantity > 0
   order by expense_date desc, created_at desc limit 1;
  v_sticker_unit := coalesce(v_sticker_unit, 0.41);

  select coalesce(sum(amount), 0) into v_consumable_spend
    from public.shop_expenses
   where unit_kind = 'consumable'
     and amount > 0
     and expense_date >= (v_now::date - 365);
  if v_consumable_spend > 0 then
    select count(*) into v_cleaned_count
      from public.orders
     where date_completed >= (v_now::date - 365)
       and lower(coalesce(services_requested, '')) like '%cleaning + conditioning%';
    if v_cleaned_count >= 10 then
      v_consumables := v_consumable_spend / v_cleaned_count;
    end if;
  end if;

  v_actual_pieces := v_primary_used + v_secondary_used;
  if nullif(p_order->>'lace_pieces_used', '') is not null then
    v_lace_pieces := greatest((p_order->>'lace_pieces_used')::numeric, 0);
    v_lace_source := 'override';
  elsif v_actual_pieces > 0 then
    v_lace_pieces := v_actual_pieces;
    v_lace_source := 'actual';
  elsif v_services like '%relacing%' then
    v_lace_pieces := case v_glove_type
      when 'Fielders Glove' then 3
      when 'Catchers Mitt' then 4
      when 'First Base Mitt' then 5
      else 4
    end;
    if v_glove_type = 'Fielders Glove' and v_web_type like '%trapeze%' then
      v_lace_pieces := v_lace_pieces + 1;
    end if;
    v_lace_source := 'estimate';
  end if;

  v_lace_cost := v_lace_pieces * v_lace_unit;
  if v_services like '%shocktec air2gel palm pad%' then v_palm_pad := 1.25; end if;
  if v_services not like '%cleaning + conditioning%' then v_consumables := 0; end if;
  v_packaging := v_card_unit + v_sticker_unit;
  v_total := v_lace_cost + v_palm_pad + v_consumables + v_packaging;
  v_net := case when v_price is null then null else v_price - v_total end;
  v_effective_rate := case
    when v_net is not null and v_labor_minutes > 0 then v_net / (v_labor_minutes / 60)
    else null
  end;

  return jsonb_build_object(
    'version', 1,
    'source', case when p_source = 'backfill' then 'backfill' else 'completion' end,
    'locked_at', v_now,
    'order_number', v_order_number,
    'status', p_order->>'status',
    'date_completed', p_order->>'date_completed',
    'price_quoted', v_price,
    'labor_minutes', v_labor_minutes,
    'labor_hours', v_labor_minutes / 60,
    'phase_minutes', v_phase_minutes,
    'lace_pieces', v_lace_pieces,
    'lace_pieces_source', v_lace_source,
    'actual_lace_pieces', case when v_actual_pieces > 0 then v_actual_pieces else null end,
    'lace_unit_cost', v_lace_unit,
    'lace_purchase_amount', v_lace_amount,
    'lace_purchase_quantity', v_lace_quantity,
    'lace_material_cost', v_lace_cost,
    'palm_pad_material_cost', v_palm_pad,
    'consumables_cost', v_consumables,
    'business_card_unit_cost', v_card_unit,
    'sticker_unit_cost', v_sticker_unit,
    'packaging_cost', v_packaging,
    'total_materials', v_total,
    'net', v_net,
    'effective_hourly_rate', v_effective_rate,
    'inputs', jsonb_build_object(
      'services_requested', p_order->>'services_requested',
      'glove_type', p_order->>'glove_type',
      'web_type', p_order->>'web_type',
      'custom_addon_amount', p_order->>'custom_addon_amount',
      'custom_addon_label', p_order->>'custom_addon_label',
      'referral_source', p_order->>'referral_source',
      'primary_lace_used', v_primary_used,
      'secondary_lace_used', v_secondary_used
    )
  );
end;
$$;

create or replace function public.lock_order_economics_on_completion()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.economics_snapshot is not null then
    new.economics_snapshot := old.economics_snapshot;
    new.economics_locked_at := old.economics_locked_at;
  elsif new.economics_snapshot is null
    and lower(coalesce(new.status, '')) in ('completed', 'picked up') then
    new.economics_snapshot := public.build_order_economics_snapshot(to_jsonb(new), 'completion');
    new.economics_locked_at := (new.economics_snapshot->>'locked_at')::timestamptz;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_lock_economics_on_completion on public.orders;
create trigger orders_lock_economics_on_completion
before insert or update on public.orders
for each row execute function public.lock_order_economics_on_completion();

-- Freeze every existing terminal order once. The builder uses only data that
-- is currently available; the source explicitly records that this is backfill.
with snapshots as materialized (
  select o.id, public.build_order_economics_snapshot(to_jsonb(o), 'backfill') snapshot
    from public.orders o
   where lower(coalesce(o.status, '')) in ('completed', 'picked up')
     and o.economics_snapshot is null
)
update public.orders o
   set economics_snapshot = s.snapshot,
       economics_locked_at = (s.snapshot->>'locked_at')::timestamptz
  from snapshots s
 where o.id = s.id
   and o.economics_snapshot is null;

create or replace function public.delete_order_completely(p_order_number text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_inventory_restored integer := 0;
  v_labor_deleted integer := 0;
  v_bench_deleted integer := 0;
  v_activity_deleted integer := 0;
  v_usage_deleted integer := 0;
  v_sms_unlinked integer := 0;
  v_gallery_unlinked integer := 0;
  v_orders_deleted integer := 0;
begin
  select * into v_order from public.orders
   where order_number = nullif(trim(p_order_number), '')
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Order not found.', 'orderNumber', trim(p_order_number));
  end if;

  with restored as (
    update public.lace_inventory li
       set quantity_on_hand = li.quantity_on_hand + x.quantity
      from (
        select color, sum(quantity) quantity
          from (values
            (nullif(trim(v_order.primary_lace_color), ''), greatest(coalesce(v_order.primary_lace_used, 0), 0)),
            (nullif(trim(v_order.secondary_lace_color), ''), greatest(coalesce(v_order.secondary_lace_used, 0), 0))
          ) as usage(color, quantity)
         where color is not null and quantity > 0
         group by color
      ) x
     where li.color = x.color
     returning 1
  ) select count(*) into v_inventory_restored from restored;

  delete from public.order_labor_sessions where order_number = v_order.order_number;
  get diagnostics v_labor_deleted = row_count;
  delete from public.bench_work_sessions where order_number = v_order.order_number;
  get diagnostics v_bench_deleted = row_count;
  delete from public.order_activity where order_number = v_order.order_number;
  get diagnostics v_activity_deleted = row_count;

  if to_regclass('public.order_lace_usage') is not null then
    execute 'delete from public.order_lace_usage where order_number = $1' using v_order.order_number;
    get diagnostics v_usage_deleted = row_count;
  end if;

  update public.sms_messages set order_number = null where order_number = v_order.order_number;
  get diagnostics v_sms_unlinked = row_count;
  update public.gallery_photo_links set order_number = null, is_cover = false where order_number = v_order.order_number;
  get diagnostics v_gallery_unlinked = row_count;
  delete from public.orders where order_number = v_order.order_number;
  get diagnostics v_orders_deleted = row_count;

  return jsonb_build_object(
    'ok', true, 'deleted', true, 'orderNumber', v_order.order_number,
    'inventoryColorsRestored', v_inventory_restored,
    'laborDeleted', v_labor_deleted,
    'benchWorkDeleted', v_bench_deleted,
    'activityDeleted', v_activity_deleted,
    'laceUsageDeleted', v_usage_deleted,
    'smsUnlinked', v_sms_unlinked,
    'galleryLinksUnlinked', v_gallery_unlinked,
    'ordersDeleted', v_orders_deleted
  );
end;
$$;

-- Idempotent cleanup of pre-existing ghosts. Never touches references whose
-- order number currently exists.
delete from public.order_labor_sessions l
 where not exists (select 1 from public.orders o where o.order_number = l.order_number);
delete from public.bench_work_sessions b
 where not exists (select 1 from public.orders o where o.order_number = b.order_number);
delete from public.order_activity a
 where not exists (select 1 from public.orders o where o.order_number = a.order_number);
do $$
begin
  if to_regclass('public.order_lace_usage') is not null then
    execute 'delete from public.order_lace_usage u where not exists (select 1 from public.orders o where o.order_number = u.order_number)';
  end if;
end $$;
update public.sms_messages m set order_number = null
 where order_number is not null
   and not exists (select 1 from public.orders o where o.order_number = m.order_number);
update public.gallery_photo_links g set order_number = null, is_cover = false
 where order_number is not null
   and not exists (select 1 from public.orders o where o.order_number = g.order_number);
