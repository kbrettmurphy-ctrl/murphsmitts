create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text null,
  role text not null default 'demo',
  password_hash text null,
  password_salt text null,
  password_iterations integer null,
  active boolean not null default true,
  invite_token text null,
  invite_expires_at timestamptz null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz null
);

create index if not exists admin_users_email_lower_idx
  on public.admin_users (lower(email));

create index if not exists admin_users_invite_token_idx
  on public.admin_users (invite_token);

-- Seed the owner account (Brett). Password is null on purpose — the owner
-- signs in via passkey/Face ID or the owner PIN escape hatch; a password can
-- be set later from the Users screen. Kept idempotent.
insert into public.admin_users (email, display_name, role, active)
select 'murphsmitts@gmail.com', 'Brett Murphy', 'admin', true
where not exists (
  select 1 from public.admin_users where lower(email) = 'murphsmitts@gmail.com'
);
