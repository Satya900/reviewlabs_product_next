-- One-click upgrade from Creator to Pro.
--
-- The creator pays the prorated difference now (an upfront amount on a new Pro
-- subscription that starts when the Creator period ends). Until they finish
-- checkout, the new subscription is kept as pending so events for the current
-- Creator subscription still reach their account.

alter table public.profiles add column pending_subscription_id text;

-- Lets an invoice say what a payment was for when the amount alone can't
-- (e.g. a prorated upgrade).
alter table public.subscription_payments add column description text check (char_length(description) <= 200);

-- Same as 0029, but uses the payment's own description when it has one.
create or replace function public.issue_plan_invoice(p_subscription_payment_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sp public.subscription_payments%rowtype;
  s public.gst_settings%rowtype;
  pr public.profiles%rowtype;
  inv uuid;
  ist timestamp := now() at time zone 'Asia/Kolkata';
  fy_start integer;
  fy text;
  n integer;
  seller_state text;
  pos text;
  taxable integer;
  tax integer;
  cgst integer := 0;
  sgst integer := 0;
  igst integer := 0;
begin
  -- Lock the payment so two callers can't both take a number for it.
  select * into sp from public.subscription_payments where id = p_subscription_payment_id for update;
  if not found or sp.status not in ('captured', 'authorized') then
    return null;
  end if;
  select id into inv from public.invoices where subscription_payment_id = sp.id;
  if found then
    return inv;
  end if;
  select * into s from public.gst_settings where id = 1;
  if s.gstin is null then
    return null;
  end if;
  select * into pr from public.profiles where id = sp.creator_id;

  fy_start := extract(year from ist)::integer - case when extract(month from ist) < 4 then 1 else 0 end;
  fy := lpad((fy_start % 100)::text, 2, '0') || '-' || lpad(((fy_start + 1) % 100)::text, 2, '0');
  insert into public.invoice_counters (financial_year, last_seq) values (fy, 1)
  on conflict (financial_year) do update set last_seq = public.invoice_counters.last_seq + 1
  returning last_seq into n;

  seller_state := left(s.gstin, 2);
  pos := coalesce(left(pr.billing_gstin, 2), pr.billing_state_code, seller_state);
  taxable := round(sp.amount_paise * 100.0 / 118);
  tax := sp.amount_paise - taxable;
  if pos = seller_state then
    cgst := tax / 2;
    sgst := tax - cgst;
  else
    igst := tax;
  end if;

  insert into public.invoices (
    invoice_number, financial_year, seq, subscription_payment_id, creator_id, paid_at, razorpay_payment_id,
    seller_legal_name, seller_trade_name, seller_gstin, seller_address, seller_state_code,
    buyer_name, buyer_email, buyer_gstin, buyer_state_code, buyer_address, place_of_supply,
    description, sac, period_end, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise)
  values (
    'RL/' || fy || '/' || lpad(n::text, 5, '0'), fy, n, sp.id, sp.creator_id, sp.created_at, sp.razorpay_payment_id,
    s.legal_name, s.trade_name, s.gstin, s.address, seller_state,
    coalesce(nullif(trim(pr.billing_name), ''), nullif(trim(pr.name), ''), pr.email), pr.email,
    pr.billing_gstin, coalesce(left(pr.billing_gstin, 2), pr.billing_state_code), pr.billing_address, pos,
    coalesce(sp.description, public.plan_invoice_description(sp.razorpay_subscription_id, sp.amount_paise)), s.sac, sp.period_end,
    taxable, cgst, sgst, igst, sp.amount_paise)
  returning id into inv;
  return inv;
end $$;
