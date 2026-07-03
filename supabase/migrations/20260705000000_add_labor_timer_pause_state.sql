-- Labor Timer V1.1: pause/resume state for order_labor_sessions.

alter table public.order_labor_sessions
  add column if not exists status text;

alter table public.order_labor_sessions
  add column if not exists paused_at timestamptz;

alter table public.order_labor_sessions
  add column if not exists pause_accumulated_seconds integer not null default 0;

update public.order_labor_sessions
set status = 'stopped'
where status is null
  and ended_at is not null;

update public.order_labor_sessions
set status = 'running'
where status is null
  and ended_at is null;

alter table public.order_labor_sessions
  alter column status set default 'running';

alter table public.order_labor_sessions
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_labor_sessions_status_check'
      and conrelid = 'public.order_labor_sessions'::regclass
  ) then
    alter table public.order_labor_sessions
      add constraint order_labor_sessions_status_check
      check (status in ('running', 'paused', 'stopped'));
  end if;
end $$;

create index if not exists order_labor_sessions_open_idx
  on public.order_labor_sessions (order_number)
  where ended_at is null;
