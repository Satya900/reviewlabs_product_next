-- =============================================================================
-- Lifetime Creator plan: one Razorpay payment, Creator with no end date.
-- =============================================================================

alter table public.profiles drop constraint profiles_plan_interval_check;
alter table public.profiles add constraint profiles_plan_interval_check check (plan_interval in ('month', 'year', 'lifetime'));

create table public.lifetime_purchases (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           uuid not null references public.profiles (id) on delete restrict,
  razorpay_order_id    text not null unique,
  razorpay_payment_id  text unique,
  amount_paise         integer not null check (amount_paise > 0),
  status               text not null default 'created' check (status in ('created', 'paid')),
  created_at           timestamptz not null default now(),
  paid_at              timestamptz
);
create index lifetime_purchases_pending_idx on public.lifetime_purchases (status, created_at);
alter table public.lifetime_purchases enable row level security;
create policy "lifetime purchases: creator read" on public.lifetime_purchases
  for select to authenticated using (creator_id = (select auth.uid()));

-- Marks a lifetime order paid and gives the creator Creator for good.
-- Idempotent: safe from the verify route, the webhook and the reconcile job.
-- Returns the subscription the creator had before, so the app can cancel it.
create or replace function public.grant_lifetime(p_razorpay_order_id text, p_razorpay_payment_id text, p_amount_paise integer)
returns table (creator_id uuid, newly_granted boolean, old_subscription_id text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  lp public.lifetime_purchases%rowtype;
  old_sub text;
begin
  select * into lp from public.lifetime_purchases where razorpay_order_id = p_razorpay_order_id for update;
  if not found then
    return;
  end if;
  if p_amount_paise <> lp.amount_paise then
    raise exception 'amount mismatch for lifetime order %: expected %, got %', lp.razorpay_order_id, lp.amount_paise, p_amount_paise;
  end if;
  if lp.status = 'paid' then
    return query select lp.creator_id, false, null::text;
    return;
  end if;

  update public.lifetime_purchases
     set status = 'paid', razorpay_payment_id = p_razorpay_payment_id, paid_at = now()
   where id = lp.id;

  select razorpay_subscription_id into old_sub from public.profiles where id = lp.creator_id for update;
  -- Clearing the subscription id means later events for it are ignored.
  update public.profiles
     set plan = 'creator', plan_status = 'active', plan_interval = 'lifetime',
         plan_current_period_end = null, razorpay_subscription_id = null
   where id = lp.creator_id;

  -- Shows in the creator's billing history next to subscription charges.
  insert into public.subscription_payments (creator_id, razorpay_subscription_id, razorpay_payment_id, amount_paise, status, period_end)
  values (lp.creator_id, 'lifetime:' || lp.razorpay_order_id, p_razorpay_payment_id, p_amount_paise, 'captured', null)
  on conflict (razorpay_payment_id) do nothing;

  return query select lp.creator_id, true, old_sub;
end $$;

revoke all on function public.grant_lifetime(text, text, integer) from public, anon, authenticated;
grant execute on function public.grant_lifetime(text, text, integer) to service_role;

-- Lifetime accounts are never downgraded by subscription events or the reconcile job.
create or replace function public.downgrade_to_free(p_creator_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  keep_id uuid;
begin
  if exists (select 1 from public.profiles where id = p_creator_id and plan_interval = 'lifetime' and plan = 'creator') then
    return;
  end if;

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
