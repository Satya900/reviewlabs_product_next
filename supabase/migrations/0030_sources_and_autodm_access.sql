-- Traffic sources for Pro analytics, and AutoDM early access while Meta
-- reviews the app.

-- ------------------------------------------------------------ traffic sources
-- Views per page per day per source (instagram, whatsapp, autodm, direct...).
-- page_views_daily keeps the totals; this adds where they came from.
create table public.page_view_sources (
  page_id  uuid not null references public.payment_pages (id) on delete cascade,
  day      date not null,
  source   text not null check (source ~ '^[a-z0-9_]{1,24}$'),
  views    integer not null default 0,
  primary key (page_id, day, source)
);
alter table public.page_view_sources enable row level security;
create policy "view sources: creator read" on public.page_view_sources
  for select to authenticated
  using (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())));

drop function if exists public.record_page_view(uuid);
create or replace function public.record_page_view(p_page_id uuid, p_source text default 'direct')
returns void
language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Kolkata')::date;
  src text := case when p_source ~ '^[a-z0-9_]{1,24}$' then p_source else 'other' end;
begin
  if not exists (select 1 from public.payment_pages where id = p_page_id and status = 'live') then
    return;
  end if;
  insert into public.page_views_daily (page_id, day, views) values (p_page_id, d, 1)
  on conflict (page_id, day) do update set views = public.page_views_daily.views + 1;
  insert into public.page_view_sources (page_id, day, source, views) values (p_page_id, d, src, 1)
  on conflict (page_id, day, source) do update set views = public.page_view_sources.views + 1;
end $$;
revoke all on function public.record_page_view(uuid, text) from public, anon, authenticated;
grant execute on function public.record_page_view(uuid, text) to service_role;

-- ------------------------------------------------------------ AutoDM early access
-- Until Meta approves the app, only people with a role on the Meta app can
-- connect. Pro creators ask here; the admin adds their Facebook account as a
-- Tester in the App Dashboard and marks the request invited.
create table public.autodm_access_requests (
  creator_id    uuid primary key references public.profiles (id) on delete cascade,
  ig_username   text not null check (ig_username ~ '^[a-z0-9._]{1,30}$'),
  -- The Facebook account they log in with; the admin adds it as a Tester.
  facebook      text not null check (char_length(facebook) between 3 and 200),
  status        text not null default 'pending' check (status in ('pending', 'invited', 'declined')),
  note          text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);
alter table public.autodm_access_requests enable row level security;
create policy "autodm access: creator read" on public.autodm_access_requests
  for select to authenticated using (creator_id = (select auth.uid()));
