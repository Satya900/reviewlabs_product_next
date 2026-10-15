-- =============================================================================
-- Pricing v2, page policies and custom-plan requests.
--
-- * Fees are all-inclusive: 6% per sale on Free, 4% on Creator, covering
--   Razorpay's charge. The creator sees one fee line; Razorpay's real fee stays
--   in public.payments for the platform's own accounting. A per-creator
--   override (commission_bps) supports custom deals.
-- * Fees are kept on refunds (Razorpay keeps its fee too).
-- * Creator billing can be monthly or yearly; first-time monthly subscribers
--   get an intro price, tracked by intro_used.
-- * Product pages can carry their own support email, refund policy and terms.
-- * Custom plan requests submitted from /custom.
-- =============================================================================

-- ---------------------------------------------------------------- profiles
alter table public.profiles
  add column plan_interval text check (plan_interval in ('month', 'year')),
  add column intro_used    boolean not null default false;

-- commission_bps becomes an optional override for custom deals.
alter table public.profiles alter column commission_bps drop not null;
alter table public.profiles alter column commission_bps drop default;
update public.profiles set commission_bps = null;

-- Fee rate for a creator right now, in basis points.
create or replace function public.creator_fee_bps(p_creator_id uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select commission_bps from public.profiles where id = p_creator_id),
    case when public.creator_has_plan(p_creator_id) then 400 else 600 end
  );
$$;
grant execute on function public.creator_fee_bps(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- fees on sales
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
  bps integer;
  fee integer;
begin
  select * into o from public.orders where razorpay_order_id = p_razorpay_order_id for update;
  if not found then
    return;
  end if;
  if p_amount_paise <> o.amount_paise then
    raise exception 'amount mismatch for order %: expected %, got %', o.id, o.amount_paise, p_amount_paise;
  end if;

  -- Razorpay's actual fee is recorded here for the platform's own books.
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
          o.page_title
            || case when o.offer_title is not null then ' + ' || o.offer_title else '' end
            || case when o.coupon_code is not null then ' (coupon ' || o.coupon_code || ')' else '' end,
          'sale:' || p_razorpay_payment_id)
  on conflict (idempotency_key) do nothing;

  -- One all-inclusive fee line, at the creator's rate when the sale happens.
  bps := public.creator_fee_bps(o.creator_id);
  fee := round(o.amount_paise * bps / 10000.0);
  if fee > 0 then
    insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
    values (o.creator_id, o.id, 'platform_fee', -fee,
            'Fees ' || rtrim(rtrim(to_char(bps / 100.0, 'FM990.99'), '0'), '.') || '% (includes payment gateway)',
            'commission:' || p_razorpay_payment_id)
    on conflict (idempotency_key) do nothing;
  end if;

  return query select o.id, not was_paid;
end $$;

-- ---------------------------------------------------------------- refunds keep the fee
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
    return;
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

    if refunded_total >= o.amount_paise then
      update public.download_grants set expires_at = now() where order_id = o.id;
    end if;
  end if;
end $$;

revoke all on function public.mark_order_paid(text, text, integer, integer, integer, text, jsonb, interval, integer) from public, anon, authenticated;
revoke all on function public.record_refund(text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, text, integer, integer, integer, text, jsonb, interval, integer) to service_role;
grant execute on function public.record_refund(text, text, integer, text, text) to service_role;

-- ---------------------------------------------------------------- page policies
alter table public.payment_pages
  add column support_email text check (support_email is null or support_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column refund_policy text not null default '' check (char_length(refund_policy) <= 3000),
  add column terms         text not null default '' check (char_length(terms) <= 3000);

-- ---------------------------------------------------------------- custom plan requests
create table public.custom_requests (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(trim(name)) between 1 and 120),
  email           text not null check (char_length(email) <= 200),
  phone           text not null default '' check (char_length(phone) <= 30),
  business        text not null default '' check (char_length(business) <= 160),
  website         text not null default '' check (char_length(website) <= 300),
  monthly_volume  text not null default '' check (char_length(monthly_volume) <= 60),
  requirements    text not null check (char_length(trim(requirements)) between 1 and 3000),
  status          text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at      timestamptz not null default now()
);
create index custom_requests_created_idx on public.custom_requests (created_at desc);
alter table public.custom_requests enable row level security;  -- service role only
