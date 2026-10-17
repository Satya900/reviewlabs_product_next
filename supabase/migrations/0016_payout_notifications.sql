-- A payout can be sent and later reversed by the bank. Remember which final
-- status the creator was emailed about, so each one is emailed exactly once.
alter table public.payouts add column notified_status text;
update public.payouts set notified_status = status where notified_at is not null;
