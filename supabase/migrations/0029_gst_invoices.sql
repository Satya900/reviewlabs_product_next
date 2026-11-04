-- GST tax invoices for plan payments (Veyrn Labs → creator).
--
-- Every captured plan payment gets one invoice with a gapless number per
-- financial year (RL/26-27/00001). Plan prices include 18% GST: CGST + SGST
-- when the creator is in our state, IGST otherwise. Invoices are issued only
-- once our GST details are filled in (gst_settings.gstin); payments before
-- that are invoiced by the reconcile job afterwards (issue_missing_invoices).

-- ------------------------------------------------------------ our details
create table public.gst_settings (
  id          smallint primary key default 1 check (id = 1),
  legal_name  text,               -- proprietor's name as on the GST certificate
  trade_name  text,               -- e.g. Veyrn Labs
  gstin       text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  address     text,
  sac         text not null default '998314',
  updated_at  timestamptz not null default now()
);
insert into public.gst_settings (id, trade_name) values (1, 'Veyrn Labs');
alter table public.gst_settings enable row level security; -- service role only

-- ------------------------------------------------------------ creator billing details
alter table public.profiles
  add column billing_name        text check (char_length(billing_name) <= 200),
  add column billing_gstin       text check (billing_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  add column billing_state_code  text check (billing_state_code ~ '^[0-9]{2}$'),
  add column billing_address     text check (char_length(billing_address) <= 500);

-- ------------------------------------------------------------ invoices
create table public.invoice_counters (
  financial_year  text primary key,
  last_seq        integer not null
);
alter table public.invoice_counters enable row level security; -- service role only

create table public.invoices (
  id                       uuid primary key default gen_random_uuid(),
  invoice_number           text not null unique,
  financial_year           text not null,
  seq                      integer not null,
  subscription_payment_id  uuid not null unique references public.subscription_payments (id) on delete restrict,
  creator_id               uuid not null references public.profiles (id) on delete restrict,
  issued_at                timestamptz not null default now(),
  paid_at                  timestamptz not null,
  razorpay_payment_id      text not null,
  -- Our details at the time of issue.
  seller_legal_name        text,
  seller_trade_name        text,
  seller_gstin             text not null,
  seller_address           text,
  seller_state_code        text not null,
  -- The creator's details at the time of issue.
  buyer_name               text not null,
  buyer_email              text not null,
  buyer_gstin              text,
  buyer_state_code         text,
  buyer_address            text,
  place_of_supply          text not null,
  description              text not null,
  sac                      text not null,
  period_end               timestamptz,
  taxable_paise            integer not null,
  cgst_paise               integer not null default 0,
  sgst_paise               integer not null default 0,
  igst_paise               integer not null default 0,
  total_paise              integer not null check (total_paise > 0),
  emailed_at               timestamptz,
  unique (financial_year, seq),
  check (taxable_paise + cgst_paise + sgst_paise + igst_paise = total_paise)
);
create index invoices_creator_idx on public.invoices (creator_id, issued_at desc);
create index invoices_issued_idx on public.invoices (issued_at desc);
alter table public.invoices enable row level security;
create policy "invoices: creator read" on public.invoices
  for select to authenticated using (creator_id = (select auth.uid()));

-- Invoices are legal records: never edited or deleted (emailed_at aside).
create or replace function public.invoices_are_final()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    -- Test rows (never issued by issue_plan_invoice, which numbers RL/...) can go.
    if old.invoice_number like 'TEST/%' then
      return old;
    end if;
    raise exception 'invoices cannot be deleted; issue a credit note instead';
  end if;
  if (to_jsonb(new) - 'emailed_at') <> (to_jsonb(old) - 'emailed_at') then
    raise exception 'invoices cannot be changed; issue a credit note instead';
  end if;
  return new;
end $$;
create trigger invoices_final before update or delete on public.invoices
  for each row execute function public.invoices_are_final();

-- ------------------------------------------------------------ issuing
create or replace function public.plan_invoice_description(p_subscription_id text, p_amount_paise integer)
returns text language sql immutable as $$
  select case
    when p_subscription_id like 'lifetime:%' then 'Reviewlabs Creator plan (lifetime)'
    when p_amount_paise = 79900 then 'Reviewlabs Creator plan (monthly)'
    when p_amount_paise = 799000 then 'Reviewlabs Creator plan (yearly)'
    when p_amount_paise = 199900 then 'Reviewlabs Pro plan (monthly)'
    when p_amount_paise = 1999000 then 'Reviewlabs Pro plan (yearly)'
    else 'Reviewlabs subscription'
  end;
$$;

-- Issues the invoice for one plan payment. Idempotent: returns the existing
-- invoice if there is one, or null when it can't be issued yet.
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
    public.plan_invoice_description(sp.razorpay_subscription_id, sp.amount_paise), s.sac, sp.period_end,
    taxable, cgst, sgst, igst, sp.amount_paise)
  returning id into inv;
  return inv;
end $$;
revoke all on function public.issue_plan_invoice(uuid) from public, anon, authenticated;
grant execute on function public.issue_plan_invoice(uuid) to service_role;

-- Every plan payment as it's recorded (checkout, webhook, reconcile, lifetime).
create or replace function public.subscription_payment_invoice()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Never let an invoice problem lose the payment; reconcile retries it.
  begin
    perform public.issue_plan_invoice(new.id);
  exception when others then
    raise warning 'invoice for subscription payment % failed: %', new.id, sqlerrm;
  end;
  return new;
end $$;
create trigger subscription_payments_invoice after insert or update of status on public.subscription_payments
  for each row when (new.status in ('captured', 'authorized'))
  execute function public.subscription_payment_invoice();

-- Payments still without an invoice (e.g. made before our GSTIN was set).
create or replace function public.issue_missing_invoices(p_limit integer default 100)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  issued integer := 0;
begin
  if (select gstin from public.gst_settings where id = 1) is null then
    return 0;
  end if;
  for r in
    select sp.id from public.subscription_payments sp
     where sp.status in ('captured', 'authorized')
       and not exists (select 1 from public.invoices i where i.subscription_payment_id = sp.id)
     order by sp.created_at
     limit p_limit
  loop
    if public.issue_plan_invoice(r.id) is not null then
      issued := issued + 1;
    end if;
  end loop;
  return issued;
end $$;
revoke all on function public.issue_missing_invoices(integer) from public, anon, authenticated;
grant execute on function public.issue_missing_invoices(integer) to service_role;
