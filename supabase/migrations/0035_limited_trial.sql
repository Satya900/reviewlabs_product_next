-- A 7-day free trial again (reverses 0028's hard paywall), now limited:
-- one product page and one lead magnet, with Creator selling features
-- (checkout, delivery, storefront, payouts) but none of Pro's (AutoDM, email
-- broadcasts, coupons, add-on offer, advanced analytics, no branding).
-- When the trial ends unpaid the store goes offline as before (0027);
-- nothing is deleted.

-- New accounts start a 7-day trial.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, trial_ends_at)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'name'), ''), now() + interval '7 days')
  on conflict (id) do nothing;
  return new;
end $$;

-- Accounts that signed up under the paywall and never had a plan or a trial
-- (an abandoned checkout still counts) get the same 7 days from now.
update public.profiles
   set trial_ends_at = now() + interval '7 days'
 where not is_admin
   and trial_ends_at is null
   and plan = 'free'
   and plan_status in ('none', 'created');

-- Pro features are for Pro only now; the trial is Creator-level.
create or replace function public.creator_has_pro(p_creator_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.creator_plan_tier(p_creator_id) = 'pro';
$$;

-- ---------------------------------------------------------------- trial limits
-- One product page and one lead magnet during the trial (archived ones don't
-- count). Paid plans have no limits.

create or replace function public.enforce_trial_page_limit()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.creator_plan_tier(new.creator_id) <> 'trial' then
    return new;
  end if;
  if exists (select 1 from public.payment_pages
              where creator_id = new.creator_id and status <> 'archived') then
    raise exception 'trial_page_limit' using errcode = 'P0001',
      hint = 'The free trial includes one product page. Choose a plan for unlimited pages.';
  end if;
  return new;
end $$;

drop trigger if exists payment_pages_trial_limit on public.payment_pages;
create trigger payment_pages_trial_limit
  before insert on public.payment_pages
  for each row execute function public.enforce_trial_page_limit();

create or replace function public.enforce_trial_lead_magnet_limit()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.creator_plan_tier(new.creator_id) <> 'trial' then
    return new;
  end if;
  if exists (select 1 from public.lead_magnets
              where creator_id = new.creator_id and status <> 'archived') then
    raise exception 'trial_lead_magnet_limit' using errcode = 'P0001',
      hint = 'The free trial includes one lead magnet. Choose a plan for unlimited lead magnets.';
  end if;
  return new;
end $$;

drop trigger if exists lead_magnets_trial_limit on public.lead_magnets;
create trigger lead_magnets_trial_limit
  before insert on public.lead_magnets
  for each row execute function public.enforce_trial_lead_magnet_limit();
