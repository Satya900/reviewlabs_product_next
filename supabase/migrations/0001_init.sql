-- =============================================================================
-- Reviewlabs: payment pages + transactions
-- Money is always stored as integer paise. The ledger is append-only.
-- All payment-state changes go through SECURITY DEFINER functions that only
-- the service role may execute, so they run atomically and idempotently.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Profiles (one per auth user)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text not null,
  name                  text,
  is_admin              boolean not null default false,
  -- Platform subscription (₹99/month by default), deducted from the balance.
  subscription_active   boolean not null default true,
  plan_amount_paise     integer not null default 9900 check (plan_amount_paise >= 0),
  -- Where the admin sends manual payouts.
  payout_upi            text,
  payout_account_name   text,
  payout_account_number text,
  payout_ifsc           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Meta Pixel / CAPI settings per creator. The access token is encrypted by the
-- app (AES-256-GCM) and this table is only reachable with the service role.
create table public.creator_pixel_settings (
  creator_id            uuid primary key references public.profiles (id) on delete cascade,
  pixel_id              text,
  capi_token_encrypted  text,
  test_event_code       text,
  updated_at            timestamptz not null default now()
);
create trigger creator_pixel_settings_updated_at before update on public.creator_pixel_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Payment pages
-- -----------------------------------------------------------------------------
create table public.payment_pages (
  id                uuid primary key default gen_random_uuid(),
  creator_id        uuid not null references public.profiles (id) on delete cascade,
  slug              text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'),
  title             text not null check (char_length(title) between 1 and 200),
  description       text not null default '',
  cover_image_url   text,
  amount_paise      integer not null check (amount_paise >= 100),
  currency          text not null default 'INR' check (currency = 'INR'),
  button_label      text not null default 'Buy now',
  thank_you_message text not null default 'Thank you for your purchase!',
  status            text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index payment_pages_creator_idx on public.payment_pages (creator_id);
create trigger payment_pages_updated_at before update on public.payment_pages
  for each row execute function public.set_updated_at();

-- Extra questions asked at checkout (name, email, phone are always collected).
create table public.page_fields (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.payment_pages (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 120),
  field_type  text not null check (field_type in ('text', 'textarea', 'number', 'select')),
  required    boolean not null default false,
  options     text[] not null default '{}',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index page_fields_page_idx on public.page_fields (page_id, position);

-- Digital files delivered after purchase (private storage bucket).
create table public.page_files (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references public.payment_pages (id) on delete cascade,
  storage_path  text not null unique,
  file_name     text not null,
  size_bytes    bigint not null default 0,
  content_type  text,
  created_at    timestamptz not null default now()
);
create index page_files_page_idx on public.page_files (page_id);

-- -----------------------------------------------------------------------------
-- Orders, payments, refunds
-- -----------------------------------------------------------------------------
create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  page_id              uuid not null references public.payment_pages (id) on delete restrict,
  creator_id           uuid not null references public.profiles (id) on delete restrict,
  page_title           text not null,
  buyer_name           text not null,
  buyer_email          text not null,
  buyer_phone          text not null,
  form_responses       jsonb not null default '{}'::jsonb,
  amount_paise         integer not null check (amount_paise > 0),
  currency             text not null default 'INR',
  status               text not null default 'created'
                         check (status in ('created', 'attempted', 'paid', 'failed', 'refunded', 'partially_refunded')),
  razorpay_order_id    text unique,
  razorpay_payment_id  text,
  -- Browser signals for Meta CAPI: fbp, fbc, client_ip, user_agent, source_url
  tracking             jsonb not null default '{}'::jsonb,
  receipt_sent_at      timestamptz,
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index orders_creator_idx on public.orders (creator_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at);
create index orders_buyer_email_idx on public.orders (lower(buyer_email));
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete restrict,
  razorpay_payment_id  text not null unique,
  status               text not null,
  method               text,
  amount_paise         integer not null,
  fee_paise            integer not null default 0,
  tax_paise            integer not null default 0,
  raw                  jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.refunds (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete restrict,
  razorpay_refund_id   text not null unique,
  razorpay_payment_id  text not null,
  amount_paise         integer not null check (amount_paise > 0),
  status               text not null check (status in ('pending', 'processed', 'failed')),
  reason               text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);
create trigger refunds_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Payouts + append-only ledger
-- -----------------------------------------------------------------------------
create table public.payouts (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.profiles (id) on delete restrict,
  amount_paise  integer not null check (amount_paise > 0),
  method        text not null check (method in ('upi', 'bank_transfer', 'other')),
  reference     text,            -- UTR / transaction reference
  note          text,
  created_by    uuid references public.profiles (id),
  paid_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index payouts_creator_idx on public.payouts (creator_id, paid_at desc);

-- amount_paise is signed: positive = owed to creator, negative = deducted/paid.
create table public.ledger_entries (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.profiles (id) on delete restrict,
  order_id         uuid references public.orders (id) on delete restrict,
  payout_id        uuid references public.payouts (id) on delete restrict,
  entry_type       text not null
                     check (entry_type in ('sale', 'gateway_fee', 'refund', 'subscription_fee', 'payout', 'adjustment')),
  amount_paise     integer not null,
  description      text,
  idempotency_key  text not null unique,
  created_at       timestamptz not null default now()
);
create index ledger_creator_idx on public.ledger_entries (creator_id, created_at desc);

create or replace function public.ledger_is_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'ledger_entries is append-only; add a correcting entry instead';
end $$;

create trigger ledger_no_update before update or delete on public.ledger_entries
  for each row execute function public.ledger_is_append_only();

create view public.creator_balances with (security_invoker = true) as
select
  p.id as creator_id,
  coalesce(sum(l.amount_paise), 0)::bigint as balance_paise,
  coalesce(sum(l.amount_paise) filter (where l.entry_type = 'sale'), 0)::bigint as gross_sales_paise,
  coalesce(-sum(l.amount_paise) filter (where l.entry_type = 'payout'), 0)::bigint as paid_out_paise
from public.profiles p
left join public.ledger_entries l on l.creator_id = p.id
group by p.id;

-- -----------------------------------------------------------------------------
-- Downloads, webhooks, Meta events
-- -----------------------------------------------------------------------------
create table public.download_grants (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null unique references public.orders (id) on delete cascade,
  token           text not null unique,
  expires_at      timestamptz not null,
  max_downloads   integer not null,
  download_count  integer not null default 0,
  last_resent_at  timestamptz,
  created_at      timestamptz not null default now()
);

create table public.webhook_events (
  id            uuid primary key default gen_random_uuid(),
  event_id      text not null unique,   -- x-razorpay-event-id
  event_type    text not null,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);

create table public.meta_events (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.profiles (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete cascade,
  event_name  text not null,
  event_id    text not null,
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts    integer not null default 0,
  last_error  text,
  response    jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (event_name, event_id)
);
create index meta_events_retry_idx on public.meta_events (status, attempts);
create trigger meta_events_updated_at before update on public.meta_events
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Payment state functions (service role only)
-- =============================================================================

-- Idempotent: safe to call from both the checkout verify route and webhooks,
-- any number of times. Returns newly_paid = true exactly once per order.
create or replace function public.mark_order_paid(
  p_razorpay_order_id    text,
  p_razorpay_payment_id  text,
  p_amount_paise         integer,
  p_fee_paise            integer,
  p_tax_paise            integer,
  p_method               text,
  p_raw                  jsonb,
  p_grant_ttl            interval,
  p_max_downloads        integer
)
returns table (order_id uuid, newly_paid boolean)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  o public.orders%rowtype;
  was_paid boolean;
begin
  select * into o from public.orders where razorpay_order_id = p_razorpay_order_id for update;
  if not found then
    -- Not one of ours (e.g. a payment link on the same Razorpay account).
    return;
  end if;
  if p_amount_paise <> o.amount_paise then
    raise exception 'amount mismatch for order %: expected %, got %', o.id, o.amount_paise, p_amount_paise;
  end if;

  insert into public.payments (order_id, razorpay_payment_id, status, method, amount_paise, fee_paise, tax_paise, raw)
  values (o.id, p_razorpay_payment_id, 'captured', p_method, p_amount_paise,
          coalesce(p_fee_paise, 0), coalesce(p_tax_paise, 0), coalesce(p_raw, '{}'::jsonb))
  on conflict (razorpay_payment_id) do update
    set status = 'captured',
        fee_paise = greatest(public.payments.fee_paise, excluded.fee_paise),
        tax_paise = greatest(public.payments.tax_paise, excluded.tax_paise),
        raw = excluded.raw;

  was_paid := o.status in ('paid', 'refunded', 'partially_refunded');

  if not was_paid then
    update public.orders
       set status = 'paid', paid_at = now(), razorpay_payment_id = p_razorpay_payment_id
     where id = o.id;

    insert into public.download_grants (order_id, token, expires_at, max_downloads)
    values (o.id, encode(gen_random_bytes(24), 'hex'), now() + p_grant_ttl, p_max_downloads)
    on conflict on constraint download_grants_order_id_key do nothing;
  end if;

  -- Ledger rows are keyed by payment id, so retries never double count.
  insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
  values (o.creator_id, o.id, 'sale', o.amount_paise, o.page_title, 'sale:' || p_razorpay_payment_id)
  on conflict (idempotency_key) do nothing;

  if coalesce(p_fee_paise, 0) > 0 then
    insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
    values (o.creator_id, o.id, 'gateway_fee', -p_fee_paise, 'Razorpay fee (incl. GST)', 'fee:' || p_razorpay_payment_id)
    on conflict (idempotency_key) do nothing;
  end if;

  return query select o.id, not was_paid;
end $$;

create or replace function public.mark_order_attempted(p_razorpay_order_id text, p_failed boolean)
returns void language sql security definer set search_path = public as $$
  update public.orders
     set status = case when p_failed then 'failed' else 'attempted' end
   where razorpay_order_id = p_razorpay_order_id
     and status in ('created', 'attempted', 'failed');
$$;

-- Records/updates a refund. Ledger entry only once it is processed.
create or replace function public.record_refund(
  p_razorpay_refund_id   text,
  p_razorpay_payment_id  text,
  p_amount_paise         integer,
  p_status               text,
  p_reason               text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  refunded_total bigint;
begin
  select ord.* into o
    from public.orders ord
    join public.payments pay on pay.order_id = ord.id
   where pay.razorpay_payment_id = p_razorpay_payment_id
   for update of ord;
  if not found then
    return;  -- Refund for a payment this app doesn't know about.
  end if;

  insert into public.refunds (order_id, razorpay_refund_id, razorpay_payment_id, amount_paise, status, reason)
  values (o.id, p_razorpay_refund_id, p_razorpay_payment_id, p_amount_paise, p_status, p_reason)
  on conflict (razorpay_refund_id) do update
    set status = case when public.refunds.status = 'processed' then 'processed' else excluded.status end,
        reason = coalesce(public.refunds.reason, excluded.reason);

  if p_status = 'processed' then
    insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
    values (o.creator_id, o.id, 'refund', -p_amount_paise, 'Refund: ' || o.page_title, 'refund:' || p_razorpay_refund_id)
    on conflict (idempotency_key) do nothing;

    select coalesce(sum(amount_paise), 0) into refunded_total
      from public.refunds where order_id = o.id and status = 'processed';

    update public.orders
       set status = case when refunded_total >= o.amount_paise then 'refunded' else 'partially_refunded' end
     where id = o.id;

    -- A full refund revokes download access.
    if refunded_total >= o.amount_paise then
      update public.download_grants set expires_at = now() where order_id = o.id;
    end if;
  end if;
end $$;

create or replace function public.record_payout(
  p_creator_id   uuid,
  p_amount_paise integer,
  p_method       text,
  p_reference    text,
  p_note         text,
  p_created_by   uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  insert into public.payouts (creator_id, amount_paise, method, reference, note, created_by)
  values (p_creator_id, p_amount_paise, p_method, p_reference, p_note, p_created_by)
  returning id into new_id;

  insert into public.ledger_entries (creator_id, payout_id, entry_type, amount_paise, description, idempotency_key)
  values (p_creator_id, new_id, 'payout', -p_amount_paise,
          'Payout' || coalesce(' · ' || p_reference, ''), 'payout:' || new_id);
  return new_id;
end $$;

-- Charges the monthly plan to every active, non-admin creator. p_month = 'YYYY-MM'.
create or replace function public.charge_subscriptions(p_month text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  charged integer;
begin
  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'invalid month %', p_month;
  end if;

  with ins as (
    insert into public.ledger_entries (creator_id, entry_type, amount_paise, description, idempotency_key)
    select id, 'subscription_fee', -plan_amount_paise, 'Subscription ' || p_month, 'sub:' || id || ':' || p_month
      from public.profiles
     where subscription_active and not is_admin and plan_amount_paise > 0
    on conflict (idempotency_key) do nothing
    returning 1
  )
  select count(*) into charged from ins;
  return charged;
end $$;

-- Atomically counts a download and returns the file to sign, or nothing.
create or replace function public.consume_download(p_token text, p_file_id uuid)
returns table (storage_path text, file_name text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  g public.download_grants%rowtype;
  f public.page_files%rowtype;
begin
  select dg.* into g from public.download_grants dg
   where dg.token = p_token and dg.expires_at > now() and dg.download_count < dg.max_downloads
   for update;
  if not found then
    return;
  end if;

  select pf.* into f
    from public.page_files pf
    join public.orders o on o.page_id = pf.page_id
   where pf.id = p_file_id and o.id = g.order_id and o.status in ('paid', 'partially_refunded');
  if not found then
    return;
  end if;

  update public.download_grants set download_count = download_count + 1 where id = g.id;
  return query select f.storage_path, f.file_name;
end $$;

revoke all on function public.mark_order_paid(text, text, integer, integer, integer, text, jsonb, interval, integer) from public, anon, authenticated;
revoke all on function public.mark_order_attempted(text, boolean) from public, anon, authenticated;
revoke all on function public.record_refund(text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.record_payout(uuid, integer, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.charge_subscriptions(text) from public, anon, authenticated;
revoke all on function public.consume_download(text, uuid) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, text, integer, integer, integer, text, jsonb, interval, integer) to service_role;
grant execute on function public.mark_order_attempted(text, boolean) to service_role;
grant execute on function public.record_refund(text, text, integer, text, text) to service_role;
grant execute on function public.record_payout(uuid, integer, text, text, text, uuid) to service_role;
grant execute on function public.charge_subscriptions(text) to service_role;
grant execute on function public.consume_download(text, uuid) to service_role;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles               enable row level security;
alter table public.creator_pixel_settings enable row level security;
alter table public.payment_pages          enable row level security;
alter table public.page_fields            enable row level security;
alter table public.page_files             enable row level security;
alter table public.orders                 enable row level security;
alter table public.payments               enable row level security;
alter table public.refunds                enable row level security;
alter table public.payouts                enable row level security;
alter table public.ledger_entries         enable row level security;
alter table public.download_grants        enable row level security;
alter table public.webhook_events         enable row level security;
alter table public.meta_events            enable row level security;
-- creator_pixel_settings, payments, download_grants, webhook_events and
-- meta_events intentionally have no policies: service role only.

-- Profiles: read own row; update only the safe columns.
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (name, payout_upi, payout_account_name, payout_account_number, payout_ifsc)
  on public.profiles to authenticated;

-- Pages: creators manage their own; anyone can read live pages.
create policy "pages: creator all" on public.payment_pages
  for all to authenticated
  using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));
create policy "pages: public read live" on public.payment_pages
  for select to anon, authenticated using (status = 'live');

create policy "fields: creator all" on public.page_fields
  for all to authenticated
  using (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())))
  with check (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())));
create policy "fields: public read live" on public.page_fields
  for select to anon, authenticated
  using (exists (select 1 from public.payment_pages p where p.id = page_id and p.status = 'live'));

create policy "files: creator all" on public.page_files
  for all to authenticated
  using (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())))
  with check (
    exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid()))
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );

-- Money tables: creators can read their own, never write.
create policy "orders: creator read" on public.orders
  for select to authenticated using (creator_id = (select auth.uid()));
create policy "refunds: creator read" on public.refunds
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.creator_id = (select auth.uid())));
create policy "payouts: creator read" on public.payouts
  for select to authenticated using (creator_id = (select auth.uid()));
create policy "ledger: creator read" on public.ledger_entries
  for select to authenticated using (creator_id = (select auth.uid()));

-- =============================================================================
-- Storage
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('product-files', 'product-files', false, 52428800)  -- 50 MB; raise on paid Supabase plans
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('page-covers', 'page-covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Objects live under "<creator uid>/...". Creators manage only their folder.
create policy "product-files: creator insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "product-files: creator read" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "product-files: creator delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "page-covers: creator insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'page-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "page-covers: creator update" on storage.objects
  for update to authenticated
  using (bucket_id = 'page-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "page-covers: creator delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'page-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
