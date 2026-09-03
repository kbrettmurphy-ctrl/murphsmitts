-- Allow an admin correction to a terminal order's service price to flow into
-- its durable economics snapshot without reopening any locked labor or
-- material-cost inputs. Also reconciles terminal orders whose price was
-- corrected before this migration. Additive and safe to rerun. Do not apply
-- automatically; this migration is reviewed/applied manually.

create or replace function public.lock_order_economics_on_completion()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_snapshot_price numeric;
  v_materials numeric;
  v_labor_minutes numeric;
  v_net numeric;
  v_effective_rate numeric;
begin
  if tg_op = 'UPDATE' and old.economics_snapshot is not null then
    -- Callers cannot replace or clear the historical snapshot directly.
    new.economics_snapshot := old.economics_snapshot;
    new.economics_locked_at := old.economics_locked_at;

    -- Price corrections are the one supported amendment. Keep the original
    -- material and labor basis, and update only the dependent money values.
    v_snapshot_price := nullif(old.economics_snapshot->>'price_quoted', '')::numeric;
    if lower(coalesce(new.status, '')) in ('completed', 'picked up')
      and new.price_quoted is distinct from v_snapshot_price then
      v_materials := nullif(old.economics_snapshot->>'total_materials', '')::numeric;
      v_labor_minutes := coalesce(nullif(old.economics_snapshot->>'labor_minutes', '')::numeric, 0);
      v_net := case
        when new.price_quoted is null or v_materials is null then null
        else new.price_quoted - v_materials
      end;
      v_effective_rate := case
        when v_net is not null and v_labor_minutes > 0 then v_net / (v_labor_minutes / 60)
        else null
      end;

      new.economics_snapshot := old.economics_snapshot || jsonb_build_object(
        'price_quoted', new.price_quoted,
        'net', v_net,
        'effective_hourly_rate', v_effective_rate,
        'price_corrected_at', clock_timestamp()
      );
    end if;
  elsif new.economics_snapshot is null
    and lower(coalesce(new.status, '')) in ('completed', 'picked up') then
    new.economics_snapshot := public.build_order_economics_snapshot(to_jsonb(new), 'completion');
    new.economics_locked_at := (new.economics_snapshot->>'locked_at')::timestamptz;
  end if;
  return new;
end;
$$;

-- Re-run terminal rows through the trigger so previously saved corrections
-- (including order #0208) are reflected immediately after this migration.
update public.orders
   set economics_snapshot = economics_snapshot
 where economics_snapshot is not null
   and lower(coalesce(status, '')) in ('completed', 'picked up')
   and price_quoted is distinct from nullif(economics_snapshot->>'price_quoted', '')::numeric;
