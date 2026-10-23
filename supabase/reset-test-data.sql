-- =============================================================================
-- Run ONCE before going live, right after switching Razorpay to live keys.
-- Paste it into the Supabase SQL editor and run it as a whole.
--
-- Part 1 removes everything test-mode payments created: orders, payments,
-- refunds, ledger entries, payouts and payout requests, plan payments and
-- lifetime purchases, download links, lead-magnet sign-ups, webhook and Meta
-- logs, view counts and rate-limit counters. Creators whose plan came from a
-- TEST subscription or TEST lifetime purchase go back to Free, because those
-- don't exist in live Razorpay.
--
-- Part 2 deletes the automated test accounts (emails ending @example.com).
--
-- KEEPS: real creator accounts and their pages, files, checkout questions,
-- testimonials, FAQs, add-on offers, lead magnets, coupons (usage reset to 0),
-- bank details and cheques, Meta Pixel settings, and plans you granted by hand
-- (no Razorpay subscription behind them).
--
-- This cannot be undone. Never run it after real sales have started.
-- =============================================================================

begin;

-- ------------------------------------------------------------- 1. test money

-- Plans that came from test-mode Razorpay go back to Free (extra live pages
-- become drafts, the same as a cancelled plan). Hand-granted plans are kept.
-- downgrade_to_free never touches lifetime accounts, so lift that first for
-- lifetime plans bought with test money (hand-granted lifetimes have no purchase).
update public.profiles p
   set plan_interval = null
 where p.plan_interval = 'lifetime'
   and exists (select 1 from public.lifetime_purchases lp where lp.creator_id = p.id);

select public.downgrade_to_free(p.id, 'none')
  from public.profiles p
 where not p.is_admin
   and (p.razorpay_subscription_id is not null
        or exists (select 1 from public.lifetime_purchases lp where lp.creator_id = p.id));

update public.profiles
   set razorpay_subscription_id = null,
       plan_interval = null,
       plan_current_period_end = null
 where not is_admin and plan = 'free';

-- Everyone gets the ₹99 first month again in live mode.
update public.profiles set intro_used = false where intro_used;

-- The ledger is append-only by design; lift that rule only for this reset.
alter table public.ledger_entries disable trigger ledger_no_update;

-- Children before parents (payout requests point at payouts, the ledger at
-- orders and payouts, payments and refunds at orders).
delete from public.payout_requests;
delete from public.ledger_entries;
delete from public.payouts;
delete from public.refunds;
delete from public.download_grants;
delete from public.meta_events;
delete from public.payments;
delete from public.orders;
delete from public.subscription_payments;
delete from public.lifetime_purchases;
delete from public.lead_email_codes;
delete from public.lead_responses;
delete from public.webhook_events;
delete from public.page_views_daily;
delete from public.lead_magnet_views_daily;
delete from public.rate_limits;
update public.coupons set used_count = 0;

alter table public.ledger_entries enable trigger ledger_no_update;

commit;

-- ------------------------------------------------------------- 2. test accounts
-- Its own step, so Part 1 stays done even if this one stops on an error.

begin;

-- Deleting the login deletes the profile and everything that belongs to it
-- (pages, lead magnets, coupons, settings). Files they uploaded stay in
-- Storage but nothing links to them any more.
delete from auth.users u
 using public.profiles p
 where p.id = u.id
   and not p.is_admin
   and p.email like '%@example.com';

-- Throwaway-email sign-ups that look like tests. Remove the "--" in front of
-- a line only if you're sure it isn't a real creator.
-- delete from auth.users where email = 'cosace2969@ensproxy.com';
-- delete from auth.users where email = 'sagegan947@hiringview.com';

commit;

-- Every count below should be 0:
select
  (select count(*) from public.orders)                as orders,
  (select count(*) from public.ledger_entries)        as ledger,
  (select count(*) from public.payouts)               as payouts,
  (select count(*) from public.payout_requests)       as payout_requests,
  (select count(*) from public.subscription_payments) as plan_payments,
  (select count(*) from public.webhook_events)        as webhooks,
  (select count(*) from public.profiles where email like '%@example.com') as test_accounts;

-- And who is on which plan now:
select email, plan, plan_status, plan_interval from public.profiles order by created_at;
