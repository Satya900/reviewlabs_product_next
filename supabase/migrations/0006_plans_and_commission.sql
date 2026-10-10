-- =============================================================================
-- Open signup, Free / Creator plans, and a fixed platform commission.
--
-- * Anyone can sign up (the invite check is removed from the signup trigger).
-- * Free: 1 product page, core selling only. Creator: unlimited pages and the
--   premium features, paid monthly through Razorpay Subscriptions.
-- * Every sale carries a platform fee (2% by default) as its own ledger line;
--   refunds return the matching share of that fee.
-- * The old "₹99 deducted from earnings" model is removed.
-- =============================================================================

-- ---------------------------------------------------------------- profiles
alter table public.profiles
  add column plan                     text not null default 'free' check (plan in ('free', 'creator')),
  add column plan_status              text not null default 'none'
    check (plan_status in ('none', 'created', 'active', 'past_due', 'cancelling', 'cancelled', 'halted', 'expired')),
  add column plan_current_period_end  timestamptz,
  add column razorpay_subscription_id text unique,
  add column commission_bps           integer not null default 200 check (commission_bps between 0 and 5000);

alter table public.profiles drop column subscription_active;
alter table public.profiles drop column plan_amount_paise;
drop function if exists public.charge_subscriptions(text);

-- ---------------------------------------------------------------- signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'name'), ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------- entitlement
-- True when the account may use Creator features. Admins always can.
-- A short grace period covers Razorpay's renewal retries.
create or replace function public.creator_has_plan(p_creator_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select is_admin
        or (plan = 'creator'
            and plan_status in ('active', 'past_due', 'cancelling')
            and (plan_current_period_end is null or plan_current_period_end > now() - interval '3 days'))
      from public.profiles where id = p_creator_id
  ), false);
$$;
grant execute on function public.creator_has_plan(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- page limit
-- Free accounts: one page (not counting archived) and one live page.
create or replace function public.enforce_page_limit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  existing integer;
begin
  if public.creator_has_plan(new.creator_id) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into existing from public.payment_pages
     where creator_id = new.creator_id and status <> 'archived';
    if existing >= 1 then
      raise exception 'free_plan_page_limit' using errcode = 'P0001',
        hint = 'The Free plan includes one product page. Upgrade to Creator for unlimited pages.';
    end if;
  end if;

  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    select count(*) into existing from public.payment_pages
     where creator_id = new.creator_id and status = 'live' and id <> new.id;
    if existing >= 1 then
      raise exception 'free_plan_live_limit' using errcode = 'P0001',
        hint = 'The Free plan can have one live page. Upgrade to Creator to publish more.';
    end if;
  end if;

  return new;
end $$;

create trigger payment_pages_plan_limit
  before insert or update of status on public.payment_pages
  for each row execute function public.enforce_page_limit();

-- Back to Free: the oldest live page stays live, other live pages become drafts.
create or replace function public.downgrade_to_free(p_creator_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  keep_id uuid;
begin
  update public.profiles
     set plan = 'free', plan_status = p_status
   where id = p_creator_id and not is_admin;

  select id into keep_id from public.payment_pages
   where creator_id = p_creator_id and status = 'live'
   order by created_at asc limit 1;

  update public.payment_pages
     set status = 'draft'
   where creator_id = p_creator_id and status = 'live' and id is distinct from keep_id;
end $$;

revoke all on function public.downgrade_to_free(uuid, text) from public, anon, authenticated;
grant execute on function public.downgrade_to_free(uuid, text) to service_role;

-- ---------------------------------------------------------------- subscription payments
-- Platform revenue from Creator plans. Never part of a creator's ledger.
create table public.subscription_payments (
  id                        uuid primary key default gen_random_uuid(),
  creator_id                uuid not null references public.profiles (id) on delete restrict,
  razorpay_subscription_id  text not null,
  razorpay_payment_id       text not null unique,
  amount_paise              integer not null,
  status                    text not null,
  period_end                timestamptz,
  raw                       jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now()
);
create index subscription_payments_creator_idx on public.subscription_payments (creator_id, created_at desc);
alter table public.subscription_payments enable row level security;
create policy "subscription payments: creator read" on public.subscription_payments
  for select to authenticated using (creator_id = (select auth.uid()));

-- ---------------------------------------------------------------- commission in the ledger
alter table public.ledger_entries drop constraint ledger_entries_entry_type_check;
alter table public.ledger_entries add constraint ledger_entries_entry_type_check
  check (entry_type in ('sale', 'gateway_fee', 'platform_fee', 'refund', 'subscription_fee', 'payout', 'adjustment'));

-- Same as 0004, plus the platform fee line.
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
  commission integer;
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

  select commission_bps into bps from public.profiles where id = o.creator_id;
  commission := round(o.amount_paise * coalesce(bps, 200) / 10000.0);
  if commission > 0 then
    insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
    values (o.creator_id, o.id, 'platform_fee', -commission,
            'Platform fee (' || rtrim(rtrim(to_char(coalesce(bps, 200) / 100.0, 'FM990.99'), '0'), '.') || '%)',
            'commission:' || p_razorpay_payment_id)
    on conflict (idempotency_key) do nothing;
  end if;

  return query select o.id, not was_paid;
end $$;

-- Same as 0001 (with the "unknown payment" early return), plus returning the
-- refunded share of the platform fee.
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
  bps integer;
  commission_back integer;
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

    -- Only return commission that was actually charged on this sale.
    if exists (select 1 from public.ledger_entries where order_id = o.id and entry_type = 'platform_fee' and amount_paise < 0) then
      select commission_bps into bps from public.profiles where id = o.creator_id;
      commission_back := round(p_amount_paise * coalesce(bps, 200) / 10000.0);
      if commission_back > 0 then
        insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
        values (o.creator_id, o.id, 'platform_fee', commission_back, 'Platform fee returned on refund',
                'commission_refund:' || p_razorpay_refund_id)
        on conflict (idempotency_key) do nothing;
      end if;
    end if;

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
