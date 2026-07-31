-- MurphOS v1.3: Bench Focus. Additive schema and atomic state transitions.

create table if not exists public.bench_work_sessions (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  resolution text not null default 'pending',
  backdate_consumed_at timestamptz,
  reminder_snoozed_until timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bench_work_sessions_resolution_check
    check (resolution in ('pending', 'labor_recorded', 'discarded')),
  constraint bench_work_sessions_time_check
    check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists bench_work_sessions_one_active_idx
  on public.bench_work_sessions ((true)) where ended_at is null;
create index if not exists bench_work_sessions_order_history_idx
  on public.bench_work_sessions (order_number, started_at desc);
create index if not exists bench_work_sessions_unresolved_idx
  on public.bench_work_sessions (ended_at desc)
  where ended_at is not null and resolution = 'pending';

alter table public.order_labor_sessions
  add column if not exists bench_work_session_id uuid;
alter table public.order_labor_sessions
  add column if not exists started_from_bench boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_labor_sessions_bench_work_session_id_fkey'
      and conrelid = 'public.order_labor_sessions'::regclass
  ) then
    alter table public.order_labor_sessions
      add constraint order_labor_sessions_bench_work_session_id_fkey
      foreign key (bench_work_session_id)
      references public.bench_work_sessions(id);
  end if;
end $$;

create index if not exists order_labor_sessions_bench_work_idx
  on public.order_labor_sessions (bench_work_session_id, started_at);
create unique index if not exists order_labor_sessions_one_bench_backdate_idx
  on public.order_labor_sessions (bench_work_session_id)
  where started_from_bench = true;

alter table public.bench_work_sessions enable row level security;

create or replace function public.start_bench_work(
  p_order_number text,
  p_created_by text default 'admin',
  p_confirm_status_override boolean default false,
  p_paused_action text default 'prompt',
  p_other_running_action text default 'prompt'
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_status text;
  v_status_key text;
  v_existing public.bench_work_sessions%rowtype;
  v_labor public.order_labor_sessions%rowtype;
  v_other public.order_labor_sessions%rowtype;
  v_bench public.bench_work_sessions%rowtype;
  v_active_seconds numeric;
  v_has_labor boolean := false;
begin
  select o.status into v_status
  from public.orders o
  where o.order_number = p_order_number
  limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'Order not found.'); end if;

  v_status_key := lower(trim(coalesce(v_status, '')));
  if v_status_key = 'in progress' then null;
  elsif v_status_key in ('customer approved', 'in transit to me', 'received', 'waiting on lace/parts', 'waiting on parts') then
    if not p_confirm_status_override then
      return jsonb_build_object('ok', false, 'requiresConfirmation', true, 'status', v_status,
        'receivedPhysicalPresence', v_status_key = 'received');
    end if;
  else
    return jsonb_build_object('ok', false, 'error', 'Bench Work is not available for this order status.', 'status', coalesce(v_status, ''));
  end if;

  select * into v_existing from public.bench_work_sessions
  where ended_at is null limit 1 for update;
  if found then
    return jsonb_build_object('ok', false, 'error', 'Another Bench Focus is already active.', 'conflict', 'active_bench',
      'activeBenchId', v_existing.id, 'activeOrderNumber', v_existing.order_number);
  end if;

  select * into v_other from public.order_labor_sessions
  where ended_at is null and status = 'running' and order_number <> p_order_number
  order by started_at desc limit 1 for update;
  if found then
    if p_other_running_action = 'pause' then
      update public.order_labor_sessions set status = 'paused', paused_at = v_now, updated_at = v_now where id = v_other.id;
    elsif p_other_running_action = 'stop' then
      v_active_seconds := greatest(0, extract(epoch from (v_now - v_other.started_at)) - coalesce(v_other.pause_accumulated_seconds, 0));
      update public.order_labor_sessions set status = 'stopped', ended_at = v_now,
        duration_minutes = round((v_active_seconds / 60.0)::numeric, 2), updated_at = v_now where id = v_other.id;
    else
      return jsonb_build_object('ok', false, 'error', 'Pause or stop the current timer first.', 'conflict', 'other_running_labor',
        'laborSessionId', v_other.id, 'laborOrderNumber', v_other.order_number);
    end if;
  end if;

  select * into v_labor from public.order_labor_sessions
  where order_number = p_order_number and ended_at is null
  order by started_at desc limit 1 for update;
  v_has_labor := found;
  if found and v_labor.status = 'paused' and p_paused_action = 'prompt' then
    return jsonb_build_object('ok', false, 'pausedLaborChoice', true, 'laborSessionId', v_labor.id);
  end if;
  if found and v_labor.status = 'paused' and p_paused_action = 'cancel' then
    return jsonb_build_object('ok', false, 'cancelled', true);
  end if;

  insert into public.bench_work_sessions (order_number, started_at, created_by, created_at, updated_at)
  values (p_order_number, v_now, nullif(trim(p_created_by), ''), v_now, v_now)
  returning * into v_bench;

  if v_has_labor and v_labor.status = 'running' then
    update public.order_labor_sessions set bench_work_session_id = v_bench.id, updated_at = v_now where id = v_labor.id;
    update public.bench_work_sessions set resolution = 'labor_recorded', backdate_consumed_at = v_now, updated_at = v_now
      where id = v_bench.id returning * into v_bench;
  elsif v_has_labor and v_labor.status = 'paused' and p_paused_action = 'resume_attach' then
    update public.order_labor_sessions set status = 'running',
      pause_accumulated_seconds = coalesce(pause_accumulated_seconds, 0) + greatest(0, extract(epoch from (v_now - paused_at)))::integer,
      paused_at = null, bench_work_session_id = v_bench.id, updated_at = v_now where id = v_labor.id;
    update public.bench_work_sessions set resolution = 'labor_recorded', backdate_consumed_at = v_now, updated_at = v_now
      where id = v_bench.id returning * into v_bench;
  end if;

  return jsonb_build_object('ok', true, 'bench', to_jsonb(v_bench));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Another Bench Focus is already active.', 'conflict', 'active_bench');
end $$;

create or replace function public.start_labor_for_bench(
  p_bench_session_id uuid,
  p_order_number text,
  p_phase text,
  p_notes text default null,
  p_mode text default 'now'
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_start timestamptz;
  v_bench public.bench_work_sessions%rowtype;
  v_open public.order_labor_sessions%rowtype;
  v_labor public.order_labor_sessions%rowtype;
begin
  if p_mode not in ('bench', 'now') then return jsonb_build_object('ok', false, 'error', 'Invalid Bench Work start mode.'); end if;
  select * into v_bench from public.bench_work_sessions where id = p_bench_session_id for update;
  if not found or v_bench.ended_at is not null then return jsonb_build_object('ok', false, 'error', 'Bench Work is no longer active.'); end if;
  if v_bench.order_number <> p_order_number then return jsonb_build_object('ok', false, 'error', 'Bench Work does not match this order.'); end if;
  if p_mode = 'bench' and v_bench.backdate_consumed_at is not null then
    return jsonb_build_object('ok', false, 'error', 'The Bench Work start time has already been used.');
  end if;
  select * into v_open from public.order_labor_sessions where ended_at is null order by started_at desc limit 1 for update;
  if found then return jsonb_build_object('ok', false, 'error', 'Pause or stop the current timer first.', 'conflict', 'open_labor',
    'laborSessionId', v_open.id, 'laborOrderNumber', v_open.order_number, 'laborStatus', v_open.status); end if;
  v_start := case when p_mode = 'bench' then v_bench.started_at else v_now end;
  insert into public.order_labor_sessions
    (order_number, phase, started_at, status, pause_accumulated_seconds, notes, updated_at,
     bench_work_session_id, started_from_bench)
  values (p_order_number, p_phase, v_start, 'running', 0, nullif(trim(p_notes), ''), v_now,
          v_bench.id, p_mode = 'bench') returning * into v_labor;
  update public.bench_work_sessions set resolution = 'labor_recorded',
    backdate_consumed_at = coalesce(backdate_consumed_at, v_now), reminder_snoozed_until = null, updated_at = v_now
    where id = v_bench.id;
  return jsonb_build_object('ok', true, 'session', to_jsonb(v_labor));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'The Bench Work start time has already been used.');
end $$;

create or replace function public.end_bench_work(
  p_bench_session_id uuid,
  p_running_action text default 'none'
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_bench public.bench_work_sessions%rowtype;
  v_labor public.order_labor_sessions%rowtype;
  v_active_seconds numeric;
begin
  select * into v_bench from public.bench_work_sessions where id = p_bench_session_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Bench Work session not found.'); end if;
  if v_bench.ended_at is not null then return jsonb_build_object('ok', false, 'error', 'Bench Work has already ended.', 'bench', to_jsonb(v_bench)); end if;
  select * into v_labor from public.order_labor_sessions
    where bench_work_session_id = v_bench.id and ended_at is null order by started_at desc limit 1 for update;
  if found and v_labor.status = 'running' then
    if p_running_action = 'pause' then
      update public.order_labor_sessions set status = 'paused', paused_at = v_now, updated_at = v_now
        where id = v_labor.id returning * into v_labor;
    elsif p_running_action = 'stop' then
      v_active_seconds := greatest(0, extract(epoch from (v_now - v_labor.started_at)) - coalesce(v_labor.pause_accumulated_seconds, 0));
      update public.order_labor_sessions set status = 'stopped', ended_at = v_now,
        duration_minutes = round((v_active_seconds / 60.0)::numeric, 2), updated_at = v_now
        where id = v_labor.id returning * into v_labor;
    else
      return jsonb_build_object('ok', false, 'runningLaborChoice', true, 'laborSessionId', v_labor.id);
    end if;
  end if;
  update public.bench_work_sessions set ended_at = v_now,
    resolution = case when resolution = 'labor_recorded' then 'labor_recorded' else 'pending' end,
    reminder_snoozed_until = null, updated_at = v_now where id = v_bench.id returning * into v_bench;
  return jsonb_build_object('ok', true, 'bench', to_jsonb(v_bench),
    'session', case when v_labor.id is null then null else to_jsonb(v_labor) end);
end $$;

create or replace function public.resolve_bench_work(
  p_bench_session_id uuid,
  p_resolution text,
  p_phase text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_bench public.bench_work_sessions%rowtype;
  v_labor public.order_labor_sessions%rowtype;
  v_minutes numeric;
begin
  select * into v_bench from public.bench_work_sessions where id = p_bench_session_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Bench Work session not found.'); end if;
  if v_bench.ended_at is null then return jsonb_build_object('ok', false, 'error', 'End Bench Work before resolving it.'); end if;
  if v_bench.resolution <> 'pending' then return jsonb_build_object('ok', false, 'error', 'Bench Work has already been resolved.', 'bench', to_jsonb(v_bench)); end if;
  if p_resolution = 'discarded' then
    update public.bench_work_sessions set resolution = 'discarded', updated_at = v_now where id = v_bench.id returning * into v_bench;
    return jsonb_build_object('ok', true, 'bench', to_jsonb(v_bench));
  end if;
  if p_resolution <> 'labor_recorded' or nullif(trim(p_phase), '') is null then
    return jsonb_build_object('ok', false, 'error', 'Select a phase before assigning time.');
  end if;
  v_minutes := round((extract(epoch from (v_bench.ended_at - v_bench.started_at)) / 60.0)::numeric, 2);
  insert into public.order_labor_sessions
    (order_number, phase, started_at, ended_at, duration_minutes, status, pause_accumulated_seconds,
     updated_at, bench_work_session_id, started_from_bench)
  values (v_bench.order_number, p_phase, v_bench.started_at, v_bench.ended_at, v_minutes, 'stopped', 0,
          v_now, v_bench.id, true) returning * into v_labor;
  update public.bench_work_sessions set resolution = 'labor_recorded', backdate_consumed_at = v_now, updated_at = v_now
    where id = v_bench.id returning * into v_bench;
  return jsonb_build_object('ok', true, 'bench', to_jsonb(v_bench), 'session', to_jsonb(v_labor));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Bench Work has already been resolved.');
end $$;
