-- =============================================================================
-- Automatic creator payouts through RazorpayX.
--
-- * A sale can be paid out 24 hours after it is recorded.
-- * start_payout() debits the ledger and creates the payout row in one step,
--   under a lock on the creator, so the same money can never be sent twice.
-- * finish_payout() applies RazorpayX's status. A failed, rejected or reversed
--   payout puts the money back on the creator's balance (payout_reversal).
-- * Manual payouts (record_payout) keep working and are stored as processed.
-- =============================================================================

-- ------------------------------------------------------------------ payouts
alter table public.payouts
  add column provider            text not null default 'manual' check (provider in ('manual', 'razorpayx')),
  add column status              text not null default 'processed'
                                   check (status in ('queued', 'processing', 'processed', 'failed', 'reversed', 'cancelled')),
  add column razorpay_payout_id  text unique,
  add column utr                 text,
  add column mode                text,
  add column destination_label   text,           -- masked, e.g. "UPI ra***@okhdfcbank"
  add column fund_account        jsonb,          -- exact destination sent to RazorpayX (reused on retry)
  add column failure_reason      text,
  add column fees_paise          integer,
  add column attempts            integer not null default 0,
  add column last_error          text,
  add column processed_at        timestamptz,
  add column notified_at         timestamptz,    -- creator emailed about the final status
  add column updated_at          timestamptz not null default now();

create index payouts_open_idx on public.payouts (status, created_at) where status in ('queued', 'processing');
create trigger payouts_updated_at before update on public.payouts
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ profiles
alter table public.profiles
  add column payouts_paused             boolean not null default false,
  add column payout_details_updated_at  timestamptz;

-- So a payout that failed on bad details is only retried after the creator fixes them.
create or replace function public.touch_payout_details()
returns trigger language plpgsql as $$
begin
  if new.payout_upi is distinct from old.payout_upi
     or new.payout_account_number is distinct from old.payout_account_number
     or new.payout_ifsc is distinct from old.payout_ifsc
     or new.payout_account_name is distinct from old.payout_account_name then
    new.payout_details_updated_at := now();
  end if;
  return new;
end $$;
create trigger profiles_payout_details before update on public.profiles
  for each row execute function public.touch_payout_details();

-- ------------------------------------------------------------------ ledger
alter table public.ledger_entries drop constraint ledger_entries_entry_type_check;
alter table public.ledger_entries add constraint ledger_entries_entry_type_check
  check (entry_type in ('sale', 'gateway_fee', 'platform_fee', 'refund', 'subscription_fee', 'payout', 'payout_reversal', 'adjustment'));

-- available_paise: what can be paid out now. Sales (and their fees) from the
-- last 24 hours are on hold; refunds, payouts and adjustments count at once.
create or replace view public.creator_balances with (security_invoker = true) as
select
  p.id as creator_id,
  coalesce(sum(l.amount_paise), 0)::bigint as balance_paise,
  coalesce(sum(l.amount_paise) filter (where l.entry_type = 'sale'), 0)::bigint as gross_sales_paise,
  coalesce(-sum(l.amount_paise) filter (where l.entry_type in ('payout', 'payout_reversal')), 0)::bigint as paid_out_paise,
  coalesce(sum(l.amount_paise) filter (
    where not (l.entry_type in ('sale', 'gateway_fee', 'platform_fee') and l.created_at > now() - interval '24 hours')
  ), 0)::bigint as available_paise
from public.profiles p
left join public.ledger_entries l on l.creator_id = p.id
group by p.id;

-- ------------------------------------------------------------------ functions
-- Reserves up to p_max_paise of the creator's available balance for a RazorpayX
-- payout. Returns nothing when there is too little to pay or a payout is
-- already on its way.
create or replace function public.start_payout(
  p_creator_id        uuid,
  p_min_paise         integer,
  p_max_paise         integer,
  p_method            text,
  p_mode              text,
  p_destination_label text,
  p_fund_account      jsonb,
  p_created_by        uuid
)
returns table (payout_id uuid, amount_paise integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  available bigint;
  amount integer;
  new_id uuid;
begin
  perform 1 from public.profiles where id = p_creator_id for update;
  if not found then
    return;
  end if;
  if exists (select 1 from public.payouts where creator_id = p_creator_id and status in ('queued', 'processing')) then
    return;
  end if;

  select b.available_paise into available from public.creator_balances b where b.creator_id = p_creator_id;
  amount := least(coalesce(available, 0), p_max_paise::bigint)::integer;
  if amount < greatest(p_min_paise, 100) then
    return;
  end if;

  insert into public.payouts (creator_id, amount_paise, method, provider, status, mode, destination_label, fund_account, created_by)
  values (p_creator_id, amount, p_method, 'razorpayx', 'queued', p_mode, p_destination_label, p_fund_account, p_created_by)
  returning id into new_id;

  insert into public.ledger_entries (creator_id, payout_id, entry_type, amount_paise, description, idempotency_key)
  values (p_creator_id, new_id, 'payout', -amount, 'Payout to ' || p_destination_label, 'payout:' || new_id);

  return query select new_id, amount;
end $$;

-- Applies a RazorpayX status. Statuses only move forward (out-of-order
-- webhooks are ignored), except processed -> reversed, which banks can do.
-- Idempotent: the reversal ledger line is written at most once.
create or replace function public.finish_payout(
  p_payout_id          uuid,
  p_status             text,
  p_razorpay_payout_id text,
  p_utr                text,
  p_failure_reason     text,
  p_fees_paise         integer
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  po public.payouts%rowtype;
  new_status text;
  old_rank int;
  new_rank int;
begin
  select * into po from public.payouts where id = p_payout_id and provider = 'razorpayx' for update;
  if not found then
    return null;
  end if;

  new_status := case p_status
    when 'queued' then 'queued'
    when 'pending' then 'queued'
    when 'processing' then 'processing'
    when 'processed' then 'processed'
    when 'reversed' then 'reversed'
    when 'failed' then 'failed'
    when 'rejected' then 'cancelled'
    when 'cancelled' then 'cancelled'
    else null end;
  if new_status is null then
    raise exception 'unknown payout status %', p_status;
  end if;

  old_rank := case po.status when 'queued' then 0 when 'processing' then 1 when 'processed' then 2 else 3 end;
  new_rank := case new_status when 'queued' then 0 when 'processing' then 1 when 'processed' then 2 else 3 end;

  -- Always keep the newest identifiers RazorpayX gives us.
  update public.payouts
     set razorpay_payout_id = coalesce(razorpay_payout_id, p_razorpay_payout_id),
         utr = coalesce(p_utr, utr),
         fees_paise = coalesce(p_fees_paise, fees_paise),
         last_error = null
   where id = po.id;

  if new_rank < old_rank or (new_rank = old_rank and new_status = po.status) or old_rank = 3 then
    return po.status;
  end if;

  update public.payouts
     set status = new_status,
         failure_reason = case when new_rank = 3 then coalesce(p_failure_reason, failure_reason) else failure_reason end,
         processed_at = case when new_status = 'processed' then now() else processed_at end,
         paid_at = case when new_status = 'processed' then now() else paid_at end
   where id = po.id;

  if new_rank = 3 then
    insert into public.ledger_entries (creator_id, payout_id, entry_type, amount_paise, description, idempotency_key)
    values (po.creator_id, po.id, 'payout_reversal', po.amount_paise,
            'Payout ' || new_status || coalesce(' · ' || p_failure_reason, '') || ', added back to your balance',
            'payout_reversal:' || po.id)
    on conflict (idempotency_key) do nothing;
  end if;

  return new_status;
end $$;

revoke all on function public.start_payout(uuid, integer, integer, text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.finish_payout(uuid, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.start_payout(uuid, integer, integer, text, text, text, jsonb, uuid) to service_role;
grant execute on function public.finish_payout(uuid, text, text, text, text, integer) to service_role;
