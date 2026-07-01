alter table public.lace_inventory
  add column if not exists reorder_alert_enabled boolean not null default true;

do $$
declare
  has_reorder_at boolean;
  has_reorder_threshold boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lace_inventory'
      and column_name = 'reorder_at'
  ) into has_reorder_at;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lace_inventory'
      and column_name = 'reorder_threshold'
  ) into has_reorder_threshold;

  if has_reorder_at then
    execute '
      update public.lace_inventory
      set reorder_alert_enabled = false,
          reorder_at = 4
      where reorder_at = -1
    ';
  end if;

  if has_reorder_threshold then
    execute '
      update public.lace_inventory
      set reorder_alert_enabled = false,
          reorder_threshold = 4
      where reorder_threshold = -1
    ';
  end if;
end $$;
