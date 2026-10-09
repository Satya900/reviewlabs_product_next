-- =============================================================================
-- Run ONCE before going live, after switching Razorpay to live keys.
--
-- Removes everything created by test-mode payments: orders, payments, refunds,
-- ledger entries, payouts, download links, webhook and Meta logs, page views
-- and rate-limit counters.
--
-- KEEPS: creator accounts, invites, payment pages, files, checkout questions,
-- coupons (usage reset to 0), and Meta Pixel settings.
--
-- This cannot be undone. Never run it after real sales have started.
-- =============================================================================

begin;

-- The ledger is append-only by design; lift that rule only for this reset.
alter table public.ledger_entries disable trigger ledger_no_update;

delete from public.ledger_entries;
delete from public.payouts;
delete from public.refunds;
delete from public.download_grants;
delete from public.meta_events;
delete from public.payments;
delete from public.orders;
delete from public.webhook_events;
delete from public.page_views_daily;
delete from public.rate_limits;
update public.coupons set used_count = 0;

alter table public.ledger_entries enable trigger ledger_no_update;

commit;

-- Every count below should be 0:
select
  (select count(*) from public.orders)          as orders,
  (select count(*) from public.ledger_entries)  as ledger,
  (select count(*) from public.payouts)         as payouts,
  (select count(*) from public.webhook_events)  as webhooks;
