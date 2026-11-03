-- AutoDM: a creator connects their Instagram professional account; when someone
-- comments a keyword on their post or reel, we send that person a DM with a
-- link (Instagram's "private reply") and optionally reply to the comment.
--
-- Access tokens live in their own table that only the service role can read.
-- Every comment we act on is logged once (unique comment_id), because
-- Instagram allows a single private reply per comment.

create table public.instagram_accounts (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null unique references public.profiles (id) on delete cascade,
  ig_user_id          text not null unique,
  username            text,
  name                text,
  profile_picture_url text,
  business_id         text,
  config_id           text,
  status              text not null default 'active' check (status in ('active', 'error')),
  last_error          text,
  subscribed_at       timestamptz,
  last_synced_at      timestamptz,
  connected_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger instagram_accounts_updated_at before update on public.instagram_accounts
  for each row execute function public.set_updated_at();

alter table public.instagram_accounts enable row level security;
create policy "instagram_accounts: creator read" on public.instagram_accounts
  for select to authenticated using (creator_id = (select auth.uid()));

create table public.instagram_tokens (
  account_id      uuid primary key references public.instagram_accounts (id) on delete cascade,
  token_encrypted text not null,
  updated_at      timestamptz not null default now()
);
alter table public.instagram_tokens enable row level security;
-- No policies: service role only.
revoke all on public.instagram_tokens from anon, authenticated;

create table public.dm_automations (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           uuid not null references public.profiles (id) on delete cascade,
  name                 text not null check (char_length(trim(name)) between 1 and 80),
  active               boolean not null default true,
  post_scope           text not null default 'all' check (post_scope in ('all', 'selected')),
  media_ids            text[] not null default '{}',
  -- Thumbnails and captions of the chosen posts, for the dashboard only.
  media_previews       jsonb not null default '[]'::jsonb,
  match_mode           text not null default 'keywords' check (match_mode in ('keywords', 'any')),
  keywords             text[] not null default '{}',
  dm_message           text not null check (char_length(trim(dm_message)) between 1 and 900),
  link_kind            text not null default 'none' check (link_kind in ('none', 'page', 'url')),
  page_id              uuid references public.payment_pages (id) on delete set null,
  link_url             text check (link_url is null or (link_url ~ '^https://[^\s]+$' and char_length(link_url) <= 2000)),
  public_reply_enabled boolean not null default false,
  public_replies       text[] not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (match_mode = 'any' or cardinality(keywords) between 1 and 20),
  check (post_scope = 'all' or cardinality(media_ids) between 1 and 50),
  check (cardinality(public_replies) <= 3),
  check (link_kind <> 'page' or page_id is not null),
  check (link_kind <> 'url' or link_url is not null)
);
create index dm_automations_creator_idx on public.dm_automations (creator_id, created_at desc);
create trigger dm_automations_updated_at before update on public.dm_automations
  for each row execute function public.set_updated_at();

alter table public.dm_automations enable row level security;
-- A linked product must be the creator's own.
create policy "dm_automations: creator all" on public.dm_automations
  for all to authenticated
  using (creator_id = (select auth.uid()))
  with check (
    creator_id = (select auth.uid())
    and (page_id is null or exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())))
  );
revoke all on public.dm_automations from anon;

create table public.dm_events (
  id                 uuid primary key default gen_random_uuid(),
  creator_id         uuid not null references public.profiles (id) on delete cascade,
  automation_id      uuid references public.dm_automations (id) on delete set null,
  comment_id         text not null unique,
  media_id           text,
  commenter_id       text,
  commenter_username text,
  comment_text       text,
  status             text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error              text,
  message_id         text,
  public_reply_id    text,
  -- Tracked link in the DM: /go/<click_token> redirects to link_url.
  click_token        text not null unique default encode(extensions.gen_random_bytes(8), 'hex'),
  link_url           text,
  clicks             integer not null default 0,
  first_clicked_at   timestamptz,
  sent_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index dm_events_creator_idx on public.dm_events (creator_id, created_at desc);
create index dm_events_automation_idx on public.dm_events (automation_id, created_at desc);

alter table public.dm_events enable row level security;
create policy "dm_events: creator read" on public.dm_events
  for select to authenticated using (creator_id = (select auth.uid()));
revoke all on public.dm_events from anon;

-- A click on a DM link: count it, return where to go.
create or replace function public.record_dm_click(p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare v_url text;
begin
  update public.dm_events
     set clicks = clicks + 1,
         first_clicked_at = coalesce(first_clicked_at, now())
   where click_token = p_token and link_url is not null
  returning link_url into v_url;
  return v_url;
end $$;
revoke all on function public.record_dm_click(text) from public, anon, authenticated;
