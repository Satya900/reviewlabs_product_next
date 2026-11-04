-- Email broadcasts (Pro): a creator emails their subscribers.
--
-- Subscribers = buyers who ticked "send me updates" at checkout, plus lead
-- magnet sign-ups (their form says they agree to receive updates), minus
-- anyone who unsubscribed from that creator.

-- ------------------------------------------------------------ consent at checkout
alter table public.orders add column marketing_opt_in boolean not null default false;

-- ------------------------------------------------------------ unsubscribes
create table public.email_unsubscribes (
  creator_id  uuid not null references public.profiles (id) on delete cascade,
  email       text not null check (email = lower(email) and char_length(email) <= 200),
  created_at  timestamptz not null default now(),
  primary key (creator_id, email)
);
alter table public.email_unsubscribes enable row level security;
create policy "unsubscribes: creator read" on public.email_unsubscribes
  for select to authenticated using (creator_id = (select auth.uid()));

-- ------------------------------------------------------------ broadcasts
create table public.broadcasts (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.profiles (id) on delete cascade,
  subject          text not null check (char_length(trim(subject)) between 1 and 150),
  body             text not null check (char_length(trim(body)) between 1 and 10000),
  button_label     text check (char_length(button_label) <= 40),
  button_url       text check (button_url ~ '^https://' and char_length(button_url) <= 2000),
  -- {"kind":"all"|"buyers"|"leads"|"page"|"magnet", "id"?: uuid}
  audience         jsonb not null default '{"kind":"all"}'::jsonb,
  status           text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  recipient_count  integer not null default 0,
  sent_count       integer not null default 0,
  failed_count     integer not null default 0,
  created_at       timestamptz not null default now(),
  finished_at      timestamptz
);
create index broadcasts_creator_idx on public.broadcasts (creator_id, created_at desc);
alter table public.broadcasts enable row level security;
create policy "broadcasts: creator read" on public.broadcasts
  for select to authenticated using (creator_id = (select auth.uid()));

create table public.broadcast_recipients (
  id            uuid primary key default gen_random_uuid(),
  broadcast_id  uuid not null references public.broadcasts (id) on delete cascade,
  creator_id    uuid not null references public.profiles (id) on delete cascade,
  email         text not null check (email = lower(email)),
  name          text not null default '',
  -- Unsubscribe link token for this email.
  token         text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  status        text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  error         text,
  claimed_at    timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (broadcast_id, email)
);
create index broadcast_recipients_pending_idx on public.broadcast_recipients (created_at) where status = 'pending';
create index broadcast_recipients_sent_idx on public.broadcast_recipients (creator_id, sent_at) where status = 'sent';
create index broadcast_recipients_day_idx on public.broadcast_recipients (sent_at) where status = 'sent';
alter table public.broadcast_recipients enable row level security;
create policy "broadcast recipients: creator read" on public.broadcast_recipients
  for select to authenticated using (creator_id = (select auth.uid()));

-- ------------------------------------------------------------ audience
-- Everyone a creator may email, de-duplicated by email (latest name wins).
-- p_kind: all | buyers | leads | page (buyers of one page) | magnet (sign-ups of one lead magnet).
create or replace function public.broadcast_audience(p_creator_id uuid, p_kind text, p_ref uuid default null)
returns table (email text, name text)
language sql stable security definer set search_path = public as $$
  with buyers as (
    select lower(o.buyer_email) as email, o.buyer_name as name, coalesce(o.paid_at, o.created_at) as at
      from public.orders o
     where o.creator_id = p_creator_id
       and o.marketing_opt_in
       and o.status in ('paid', 'partially_refunded')
       and (p_kind in ('all', 'buyers') or (p_kind = 'page' and o.page_id = p_ref))
  ),
  leads as (
    select lower(l.email) as email, l.name, l.created_at as at
      from public.lead_responses l
     where l.creator_id = p_creator_id
       and (p_kind in ('all', 'leads') or (p_kind = 'magnet' and l.magnet_id = p_ref))
  ),
  everyone as (
    select * from buyers union all select * from leads
  )
  select distinct on (e.email) e.email, e.name
    from everyone e
   where e.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     and not exists (select 1 from public.email_unsubscribes u where u.creator_id = p_creator_id and u.email = e.email)
   order by e.email, e.at desc;
$$;
revoke all on function public.broadcast_audience(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.broadcast_audience(uuid, text, uuid) to service_role;

-- Creates a broadcast and its recipient list in one go, if it fits in the
-- creator's monthly allowance. Returns the broadcast id and the count.
create or replace function public.create_broadcast(
  p_creator_id uuid, p_subject text, p_body text, p_button_label text, p_button_url text,
  p_kind text, p_ref uuid, p_monthly_limit integer)
returns table (broadcast_id uuid, recipients integer, used integer)
language plpgsql security definer set search_path = public as $$
declare
  b uuid;
  n integer;
  month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  already integer;
begin
  -- One at a time per creator, so two clicks can't both pass the limit.
  perform pg_advisory_xact_lock(hashtext('broadcast:' || p_creator_id::text));
  select count(*) into already from public.broadcast_recipients r
   where r.creator_id = p_creator_id and r.created_at >= month_start and r.status <> 'skipped';
  select count(*) into n from public.broadcast_audience(p_creator_id, p_kind, p_ref);
  if n = 0 then
    return query select null::uuid, 0, already;
    return;
  end if;
  if already + n > p_monthly_limit then
    return query select null::uuid, n, already;
    return;
  end if;
  insert into public.broadcasts (creator_id, subject, body, button_label, button_url, audience, recipient_count)
  values (p_creator_id, p_subject, p_body, nullif(p_button_label, ''), nullif(p_button_url, ''),
          jsonb_build_object('kind', p_kind, 'id', p_ref), n)
  returning id into b;
  insert into public.broadcast_recipients (broadcast_id, creator_id, email, name)
  select b, p_creator_id, a.email, coalesce(a.name, '') from public.broadcast_audience(p_creator_id, p_kind, p_ref) a;
  return query select b, n, already;
end $$;
revoke all on function public.create_broadcast(uuid, text, text, text, text, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.create_broadcast(uuid, text, text, text, text, text, uuid, integer) to service_role;

-- Claims up to p_limit pending recipients for sending (oldest broadcasts
-- first), skipping rows another worker holds.
create or replace function public.claim_broadcast_recipients(p_limit integer)
returns setof public.broadcast_recipients
language sql security definer set search_path = public as $$
  -- A send that crashed mid-way (claimed over 15 minutes ago) is retried.
  update public.broadcast_recipients
     set status = 'pending'
   where status = 'sending' and claimed_at < now() - interval '15 minutes';
  update public.broadcast_recipients r
     set status = 'sending', claimed_at = now()
   where r.id in (
     select id from public.broadcast_recipients
      where status = 'pending'
      order by created_at
      limit p_limit
      for update skip locked)
  returning r.*;
$$;
revoke all on function public.claim_broadcast_recipients(integer) from public, anon, authenticated;
grant execute on function public.claim_broadcast_recipients(integer) to service_role;

-- Updates a broadcast's counts, and marks it sent once nothing is left.
create or replace function public.refresh_broadcast(p_broadcast_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.broadcasts b
     set sent_count = c.sent,
         failed_count = c.failed,
         status = case when c.open = 0 then (case when c.sent = 0 and c.failed > 0 then 'failed' else 'sent' end) else 'sending' end,
         finished_at = case when c.open = 0 then coalesce(b.finished_at, now()) else null end
    from (
      select count(*) filter (where status = 'sent') as sent,
             count(*) filter (where status = 'failed') as failed,
             count(*) filter (where status in ('pending', 'sending')) as open
        from public.broadcast_recipients where broadcast_id = p_broadcast_id
    ) c
   where b.id = p_broadcast_id;
$$;
revoke all on function public.refresh_broadcast(uuid) from public, anon, authenticated;
grant execute on function public.refresh_broadcast(uuid) to service_role;
