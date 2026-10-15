-- =============================================================================
-- Lead magnets as their own service: a public form (reviewlabs.space/l/slug)
-- with custom questions, optional free files and optional email verification.
-- Responses live in their own table, separate from orders and money.
--
-- Also removes the earlier "free product page" approach from 0012.
-- =============================================================================

-- ---------------------------------------------------------------- undo free product pages
update public.payment_pages set is_free = false, amount_paise = 100, status = 'draft' where is_free;
alter table public.payment_pages drop constraint payment_pages_amount_paise_check;
alter table public.payment_pages drop column is_free;
alter table public.payment_pages add constraint payment_pages_amount_paise_check check (amount_paise >= 100);

delete from public.orders where amount_paise = 0;  -- test claims made with the old approach
alter table public.orders drop constraint orders_amount_paise_check;
alter table public.orders add constraint orders_amount_paise_check check (amount_paise > 0);
drop index if exists public.orders_page_email_idx;
drop function if exists public.claim_free_product(uuid, text, text, text, jsonb, jsonb, interval, integer);

-- ---------------------------------------------------------------- lead magnets
create table public.lead_magnets (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           uuid not null references public.profiles (id) on delete cascade,
  slug                 text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'),
  title                text not null check (char_length(trim(title)) between 1 and 50),
  description          text not null default '' check (char_length(description) <= 80),
  button_label         text not null default 'Get it now' check (char_length(trim(button_label)) between 1 and 25),
  cover_preset         text not null default 'ocean' check (cover_preset in ('ocean', 'sunset', 'aurora', 'midnight', 'blush')),
  cover_image_url      text,
  collect_phone        boolean not null default false,
  phone_required       boolean not null default false,
  verify_email         boolean not null default false,
  thank_you_message    text not null default 'Thanks! Check your inbox for your free resource.' check (char_length(thank_you_message) <= 1000),
  redirect_url         text check (redirect_url is null or redirect_url ~* '^https?://'),
  recommended_page_id  uuid references public.payment_pages (id) on delete set null,
  status               text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  storefront_visible   boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index lead_magnets_creator_idx on public.lead_magnets (creator_id, created_at desc);
create trigger lead_magnets_updated_at before update on public.lead_magnets
  for each row execute function public.set_updated_at();

-- Extra questions beyond the fixed name, email and optional phone.
create table public.lead_magnet_questions (
  id          uuid primary key default gen_random_uuid(),
  magnet_id   uuid not null references public.lead_magnets (id) on delete cascade,
  label       text not null check (char_length(trim(label)) between 1 and 120),
  field_type  text not null check (field_type in ('text', 'textarea', 'number', 'select')),
  required    boolean not null default false,
  options     text[] not null default '{}',
  position    integer not null default 0
);
create index lead_magnet_questions_magnet_idx on public.lead_magnet_questions (magnet_id, position);

-- Free files given after the form (private product-files bucket).
create table public.lead_magnet_files (
  id            uuid primary key default gen_random_uuid(),
  magnet_id     uuid not null references public.lead_magnets (id) on delete cascade,
  storage_path  text not null unique,
  file_name     text not null,
  size_bytes    bigint not null default 0,
  content_type  text,
  created_at    timestamptz not null default now()
);
create index lead_magnet_files_magnet_idx on public.lead_magnet_files (magnet_id);

-- One response per email per lead magnet.
create table public.lead_responses (
  id              uuid primary key default gen_random_uuid(),
  magnet_id       uuid not null references public.lead_magnets (id) on delete cascade,
  creator_id      uuid not null references public.profiles (id) on delete cascade,
  name            text not null check (char_length(trim(name)) between 1 and 120),
  email           text not null check (char_length(email) <= 200),
  phone           text not null default '' check (char_length(phone) <= 30),
  answers         jsonb not null default '{}'::jsonb,
  email_verified  boolean not null default false,
  download_token  text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  tracking        jsonb not null default '{}'::jsonb,
  email_sent_at   timestamptz,
  created_at      timestamptz not null default now()
);
create unique index lead_responses_magnet_email_key on public.lead_responses (magnet_id, lower(email));
create index lead_responses_creator_idx on public.lead_responses (creator_id, created_at desc);

-- Email verification codes (hashed), short-lived.
create table public.lead_email_codes (
  id          uuid primary key default gen_random_uuid(),
  magnet_id   uuid not null references public.lead_magnets (id) on delete cascade,
  email       text not null,
  code_hash   text not null,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index lead_email_codes_lookup_idx on public.lead_email_codes (magnet_id, lower(email), created_at desc);

-- Daily views for conversion rate.
create table public.lead_magnet_views_daily (
  magnet_id  uuid not null references public.lead_magnets (id) on delete cascade,
  day        date not null,
  views      integer not null default 0,
  primary key (magnet_id, day)
);

create or replace function public.record_lead_magnet_view(p_magnet_id uuid)
returns void
language sql security definer set search_path = public as $$
  insert into public.lead_magnet_views_daily (magnet_id, day, views)
  select p_magnet_id, (now() at time zone 'Asia/Kolkata')::date, 1
   where exists (select 1 from public.lead_magnets where id = p_magnet_id and status = 'live')
  on conflict (magnet_id, day) do update set views = public.lead_magnet_views_daily.views + 1;
$$;
revoke all on function public.record_lead_magnet_view(uuid) from public, anon, authenticated;
grant execute on function public.record_lead_magnet_view(uuid) to service_role;

-- ---------------------------------------------------------------- Free plan: one lead magnet
create or replace function public.enforce_lead_magnet_limit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  existing integer;
begin
  if public.creator_has_plan(new.creator_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select count(*) into existing from public.lead_magnets where creator_id = new.creator_id and status <> 'archived';
    if existing >= 1 then
      raise exception 'free_plan_lead_magnet_limit' using errcode = 'P0001',
        hint = 'The Free plan includes one lead magnet. Upgrade to Creator for unlimited lead magnets.';
    end if;
  end if;
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    select count(*) into existing from public.lead_magnets where creator_id = new.creator_id and status = 'live' and id <> new.id;
    if existing >= 1 then
      raise exception 'free_plan_lead_magnet_limit' using errcode = 'P0001',
        hint = 'The Free plan includes one live lead magnet. Upgrade to Creator for unlimited lead magnets.';
    end if;
  end if;
  return new;
end $$;
create trigger lead_magnets_plan_limit before insert or update on public.lead_magnets
  for each row execute function public.enforce_lead_magnet_limit();

-- ---------------------------------------------------------------- access
alter table public.lead_magnets enable row level security;
alter table public.lead_magnet_questions enable row level security;
alter table public.lead_magnet_files enable row level security;
alter table public.lead_responses enable row level security;
alter table public.lead_email_codes enable row level security;  -- service role only
alter table public.lead_magnet_views_daily enable row level security;

create policy "lead magnets: creator all" on public.lead_magnets
  for all to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

create policy "lead questions: creator all" on public.lead_magnet_questions
  for all to authenticated
  using (exists (select 1 from public.lead_magnets m where m.id = magnet_id and m.creator_id = (select auth.uid())))
  with check (exists (select 1 from public.lead_magnets m where m.id = magnet_id and m.creator_id = (select auth.uid())));

create policy "lead files: creator all" on public.lead_magnet_files
  for all to authenticated
  using (exists (select 1 from public.lead_magnets m where m.id = magnet_id and m.creator_id = (select auth.uid())))
  with check (
    exists (select 1 from public.lead_magnets m where m.id = magnet_id and m.creator_id = (select auth.uid()))
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );

-- Creators read their leads; responses are only written by the server.
create policy "lead responses: creator read" on public.lead_responses
  for select to authenticated using (creator_id = (select auth.uid()));

create policy "lead views: creator read" on public.lead_magnet_views_daily
  for select to authenticated
  using (exists (select 1 from public.lead_magnets m where m.id = magnet_id and m.creator_id = (select auth.uid())));
