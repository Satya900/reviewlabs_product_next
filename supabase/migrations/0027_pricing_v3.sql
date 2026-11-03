-- =============================================================================
-- Pricing v3: no free plan, a 7-day trial, Creator and Pro plans, and no
-- platform fee on sales.
--
-- * Every new creator gets a 7-day trial with every feature. Creators on Free
--   today get theirs from the day this runs.
-- * Creator (₹799/month) and Pro (₹1,999/month, adds AutoDM). Lifetime
--   accounts stay on Creator for good.
-- * Without a plan or trial the creator's store is offline: product pages,
--   storefront and lead magnets stop taking buyers. Nothing is deleted or
--   unpublished, so everything comes back the moment they subscribe.
-- * 0% platform fee. Razorpay's charge for each sale is passed on at cost, as
--   its own ledger line. A custom commission (commission_bps) still works.
-- * No page or lead magnet limits (they only existed for the Free plan).
-- =============================================================================

-- ---------------------------------------------------------------- profiles
alter table public.profiles drop constraint profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan in ('free', 'creator', 'pro'));

alter table public.profiles
  add column trial_ends_at           timestamptz,
  add column trial_reminder_sent_at  timestamptz,
  add column trial_ended_email_at    timestamptz;

-- Today's Free creators: a 7-day trial from now.
update public.profiles
   set trial_ends_at = now() + interval '7 days'
 where not is_admin and plan = 'free';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, trial_ends_at)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'name'), ''), now() + interval '7 days')
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------- entitlement
-- The creator's tier right now: 'pro', 'creator', 'trial' (every feature) or
-- 'none' (store offline). Admins count as Pro. A paid plan keeps working for
-- 3 days past its period end while Razorpay retries the renewal.
create or replace function public.creator_plan_tier(p_creator_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when is_admin then 'pro'
      when plan in ('creator', 'pro')
           and plan_status in ('active', 'past_due', 'cancelling')
           and (plan_current_period_end is null or plan_current_period_end > now() - interval '3 days')
        then plan
      when trial_ends_at > now() then 'trial'
      else 'none'
    end
      from public.profiles where id = p_creator_id
  ), 'none');
$$;
grant execute on function public.creator_plan_tier(uuid) to authenticated, service_role;

-- Creator features and a live store: any paid plan or the trial.
create or replace function public.creator_has_plan(p_creator_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.creator_plan_tier(p_creator_id) <> 'none';
$$;

-- Pro features (AutoDM): Pro, the trial, or an admin.
create or replace function public.creator_has_pro(p_creator_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.creator_plan_tier(p_creator_id) in ('pro', 'trial');
$$;
grant execute on function public.creator_has_pro(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- no Free limits
drop trigger if exists payment_pages_plan_limit on public.payment_pages;
drop function if exists public.enforce_page_limit();
drop trigger if exists lead_magnets_plan_limit on public.lead_magnets;
drop function if exists public.enforce_lead_magnet_limit();

-- Plan ended: back to no plan. Pages stay as they are (the store is offline
-- until they subscribe again). Lifetime accounts are never downgraded.
create or replace function public.downgrade_to_free(p_creator_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set plan = 'free', plan_status = p_status
   where id = p_creator_id
     and not is_admin
     and not (plan_interval = 'lifetime' and plan = 'creator');
end $$;

-- ---------------------------------------------------------------- fees
-- Platform fee: 0%, unless the creator has a custom commission.
create or replace function public.creator_fee_bps(p_creator_id uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select commission_bps from public.profiles where id = p_creator_id), 0);
$$;

-- Razorpay's charge if a payment arrives without it (about 2% + 18% GST).
create or replace function public.estimated_gateway_fee(p_amount_paise integer)
returns integer
language sql immutable as $$
  select round(p_amount_paise * 236 / 10000.0)::integer;
$$;

-- Same as 0011, with the fee lines changed: Razorpay's actual charge for this
-- payment as a "gateway_fee" line, and a platform fee only for custom deals.
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
  gateway integer;
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
          o.page_title
            || case when o.offer_title is not null then ' + ' || o.offer_title else '' end
            || case when o.coupon_code is not null then ' (coupon ' || o.coupon_code || ')' else '' end,
          'sale:' || p_razorpay_payment_id)
  on conflict (idempotency_key) do nothing;

  -- Razorpay's charge (fee includes its GST), passed on at cost.
  gateway := case when coalesce(p_fee_paise, 0) > 0 then p_fee_paise else public.estimated_gateway_fee(o.amount_paise) end;
  if gateway > 0 then
    insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
    values (o.creator_id, o.id, 'gateway_fee', -gateway, 'Payment gateway charge (Razorpay, at cost)', 'gateway:' || p_razorpay_payment_id)
    on conflict (idempotency_key) do nothing;
  end if;

  -- Platform fee: only for creators with a custom commission.
  bps := public.creator_fee_bps(o.creator_id);
  fee := round(o.amount_paise * bps / 10000.0);
  if fee > 0 then
    insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
    values (o.creator_id, o.id, 'platform_fee', -fee,
            'Platform fee ' || rtrim(rtrim(to_char(bps / 100.0, 'FM990.99'), '0'), '.') || '%',
            'commission:' || p_razorpay_payment_id)
    on conflict (idempotency_key) do nothing;
  end if;

  return query select o.id, not was_paid;
end $$;

revoke all on function public.mark_order_paid(text, text, integer, integer, integer, text, jsonb, interval, integer) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, text, integer, integer, integer, text, jsonb, interval, integer) to service_role;
