-- When the last verification link was emailed, so the dashboard says "we sent
-- a link" instead of inviting a second email straight after signup, and a
-- resend within a few minutes doesn't send another.
alter table public.profiles add column verification_sent_at timestamptz;
