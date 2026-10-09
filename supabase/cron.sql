-- =============================================================================
-- Run this ONCE in the Supabase SQL editor AFTER the site is live.
--
-- Vercel's Hobby plan only allows daily crons (vercel.json runs reconcile once
-- a day). This schedules the same endpoint every 15 minutes from Supabase, so
-- missed Razorpay webhooks are recovered quickly.
--
-- Before running:
--   1. Supabase → Database → Extensions: enable "pg_cron" and "pg_net".
--   2. Replace PASTE_CRON_SECRET_HERE with the CRON_SECRET you set in Vercel.
--   3. Replace https://reviewlabs.space if your live URL is different.
-- =============================================================================

-- Store the secret in Supabase Vault instead of plain text in the job.
select vault.create_secret('PASTE_CRON_SECRET_HERE', 'reviewlabs_cron_secret', 'Bearer token for /api/cron/*');

select cron.schedule(
  'reviewlabs-reconcile',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://reviewlabs.space/api/cron/reconcile',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reviewlabs_cron_secret')
    ),
    timeout_milliseconds := 55000
  );
  $$
);

-- Check it ran (look for status 200 in the response table a few minutes later):
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select status_code, content from net._http_response order by created desc limit 5;
--
-- To remove it later (e.g. after upgrading to Vercel Pro):
--   select cron.unschedule('reviewlabs-reconcile');
