-- =============================================================================
-- 1. Invite-only creator accounts
--    Signup is blocked in the database itself, so it holds even if someone
--    calls the Supabase Auth API directly with the publishable key.
-- 2. Simple fixed-window rate limiting backed by Postgres.
-- =============================================================================

create table public.creator_invites (
  email       text primary key check (email = lower(email)),
  invited_by  uuid references public.profiles (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.creator_invites enable row level security;  -- service role only

-- Everyone who already has an account counts as invited.
insert into public.creator_invites (email)
select lower(email) from public.profiles
on conflict (email) do nothing;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.creator_invites where email = lower(new.email)) then
    raise exception 'signup_not_invited' using errcode = 'P0001';
  end if;
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

-- -----------------------------------------------------------------------------
create table public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  count         integer not null
);
alter table public.rate_limits enable row level security;  -- service role only

-- Returns true if the request is allowed.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  current_count integer;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds)
                            then now() else rl.window_start end,
        count = case when rl.window_start < now() - make_interval(secs => p_window_seconds)
                     then 1 else rl.count + 1 end
  returning count into current_count;
  return current_count <= p_limit;
end $$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
