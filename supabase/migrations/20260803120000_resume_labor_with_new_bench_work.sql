-- MurphOS v1.3 follow-up: atomically resume paused labor into a new Bench Work session.

create or replace function public.resume_labor_with_new_bench_work(
  p_labor_session_id uuid,
  p_created_by text default 'admin'
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_labor public.order_labor_sessions%rowtype;
  v_active_bench public.bench_work_sessions%rowtype;
  v_other_labor public.order_labor_sessions%rowtype;
  v_bench public.bench_work_sessions%rowtype;
  v_paused_seconds integer;
begin
  -- Serialize the singleton active-Bench decision even when no row exists yet.
  perform pg_advisory_xact_lock(hashtext('murphos_active_bench_work')::bigint);

  select * into v_labor
  from public.order_labor_sessions
  where id = p_labor_session_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Labor session not found.', 'conflict', 'labor_missing');
  end if;
  if v_labor.ended_at is not null or v_labor.status <> 'paused' then
    return jsonb_build_object('ok', false, 'error', 'The labor session is no longer paused.', 'conflict', 'labor_state_changed');
  end if;

  select * into v_active_bench
  from public.bench_work_sessions
  where ended_at is null
  limit 1
  for update;
  if found then
    return jsonb_build_object(
      'ok', false,
      'error', 'Another Bench Focus is already active.',
      'conflict', 'active_bench',
      'activeBenchId', v_active_bench.id,
      'activeOrderNumber', v_active_bench.order_number
    );
  end if;

  select * into v_other_labor
  from public.order_labor_sessions
  where ended_at is null and status = 'running' and id <> v_labor.id
  order by started_at desc
  limit 1
  for update;
  if found then
    return jsonb_build_object(
      'ok', false,
      'error', 'Pause or stop the current timer first.',
      'conflict', 'other_running_labor',
      'laborSessionId', v_other_labor.id,
      'laborOrderNumber', v_other_labor.order_number
    );
  end if;

  insert into public.bench_work_sessions (
    order_number, started_at, resolution, backdate_consumed_at,
    created_by, created_at, updated_at
  ) values (
    v_labor.order_number, v_now, 'labor_recorded', v_now,
    nullif(trim(p_created_by), ''), v_now, v_now
  ) returning * into v_bench;

  v_paused_seconds := case
    when v_labor.paused_at is null then 0
    else greatest(0, round(extract(epoch from (v_now - v_labor.paused_at))))::integer
  end;

  update public.order_labor_sessions set
    status = 'running',
    paused_at = null,
    pause_accumulated_seconds = coalesce(pause_accumulated_seconds, 0) + v_paused_seconds,
    bench_work_session_id = v_bench.id,
    started_from_bench = false,
    updated_at = v_now
  where id = v_labor.id
  returning * into v_labor;

  return jsonb_build_object('ok', true, 'bench', to_jsonb(v_bench), 'session', to_jsonb(v_labor));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Another Bench Focus is already active.', 'conflict', 'active_bench');
end $$;
