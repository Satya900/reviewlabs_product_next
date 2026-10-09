-- =============================================================================
-- 1. Coupons: creators create discount codes for their own pages.
-- 2. Page analytics: daily view counts per page (orders give checkouts/sales).
-- =============================================================================

create table public.coupons (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references public.profiles (id) on delete cascade,
  page_id        uuid references public.payment_pages (id) on delete cascade,  -- null = all of the creator's pages
  code           text not null check (code ~ '^[A-Z0-9_-]{3,30}$'),
  discount_type  text not null check (discount_type in ('percent', 'flat')),
  value          integer not null check (value > 0),          -- percent (1-100) or paise
  max_uses       integer check (max_uses is null or max_uses > 0),
  used_count     integer not null default 0,
  expires_at     timestamptz,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (creator_id, code),
  check (discount_type <> 'percent' or value <= 100)
);
create index coupons_creator_idx on public.coupons (creator_id);

alter table public.coupons enable row level security;
create policy "coupons: creator all" on public.coupons
  for all to authenticated
  using (creator_id = (select auth.uid()))
  with check (
    creator_id = (select auth.uid())
    and (page_id is null or exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())))
  );
-- Usage counts are only changed by mark_order_paid, so creators may update
-- every column except used_count.
revoke update on public.coupons from authenticated;
grant update (code, discount_type, value, max_uses, expires_at, active, page_id) on public.coupons to authenticated;

alter table public.orders
  add column list_price_paise integer,
  add column discount_paise   integer not null default 0 check (discount_paise >= 0),
  add column coupon_id        uuid references public.coupons (id) on delete set null,
  add column coupon_code      text;

-- Same as 0002, plus: count a coupon use when an order becomes paid.
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
    values (o.id, encode(gen_random_bytes(24), 'hex'),
            case when p_grant_ttl is null then null else now() + p_grant_ttl end,
            p_max_downloads)
    on conflict on constraint download_grants_order_id_key do nothing;

    if o.coupon_id is not null then
      update public.coupons set used_count = used_count + 1 where id = o.coupon_id;
    end if;
  end if;

  insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
  values (o.creator_id, o.id, 'sale', o.amount_paise,
          o.page_title || case when o.coupon_code is not null then ' (coupon ' || o.coupon_code || ')' else '' end,
          'sale:' || p_razorpay_payment_id)
  on conflict (idempotency_key) do nothing;

  if coalesce(p_fee_paise, 0) > 0 then
    insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
    values (o.creator_id, o.id, 'gateway_fee', -p_fee_paise, 'Razorpay fee (incl. GST)', 'fee:' || p_razorpay_payment_id)
    on conflict (idempotency_key) do nothing;
  end if;

  return query select o.id, not was_paid;
end $$;

revoke all on function public.mark_order_paid(text, text, integer, integer, integer, text, jsonb, interval, integer) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, text, integer, integer, integer, text, jsonb, interval, integer) to service_role;

-- -----------------------------------------------------------------------------
create table public.page_views_daily (
  page_id  uuid not null references public.payment_pages (id) on delete cascade,
  day      date not null,
  views    integer not null default 0,
  primary key (page_id, day)
);
alter table public.page_views_daily enable row level security;
create policy "views: creator read" on public.page_views_daily
  for select to authenticated
  using (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())));

create or replace function public.record_page_view(p_page_id uuid)
returns void
language sql security definer set search_path = public as $$
  insert into public.page_views_daily (page_id, day, views)
  select p_page_id, (now() at time zone 'Asia/Kolkata')::date, 1
   where exists (select 1 from public.payment_pages where id = p_page_id and status = 'live')
  on conflict (page_id, day) do update set views = public.page_views_daily.views + 1;
$$;

revoke all on function public.record_page_view(uuid) from public, anon, authenticated;
grant execute on function public.record_page_view(uuid) to service_role;
