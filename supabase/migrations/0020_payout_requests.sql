-- Payouts on request: creators ask for a payout (₹500 minimum, up to their
-- available balance) to a bank account they've submitted with a cancelled
-- cheque, and an admin approves it. Replaces the daily automatic run.

-- ------------------------------------------------------------------ bank details
alter table public.profiles
  add column payout_bank_name          text,
  add column payout_cheque_path        text,
  add column payout_bank_submitted_at  timestamptz;

-- Bank details now only change through the server (with a new cheque each time),
-- so creators can't edit them directly any more.
revoke update (payout_upi, payout_account_name, payout_account_number, payout_ifsc) on public.profiles from authenticated;

-- Cancelled cheques: private, under "<creator uid>/...". Admins read them with
-- the service role (signed links); creators can only upload into their folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payout-documents', 'payout-documents', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "payout-documents: creator insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payout-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "payout-documents: creator read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payout-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ------------------------------------------------------------------ requests
create table public.payout_requests (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.profiles (id) on delete cascade,
  amount_paise    integer not null check (amount_paise >= 50000),
  status          text not null default 'pending' check (status in ('pending', 'paid', 'rejected', 'cancelled')),
  -- The bank details the creator asked to be paid to, as they were at the time.
  account_name    text not null,
  account_number  text not null,
  ifsc            text not null,
  bank_name       text,
  cheque_path     text not null,
  payout_id       uuid references public.payouts (id),
  utr             text,
  reject_reason   text,
  decided_by      uuid references public.profiles (id),
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);
-- One open request per creator.
create unique index payout_requests_one_pending on public.payout_requests (creator_id) where status = 'pending';
create index payout_requests_status_idx on public.payout_requests (status, created_at desc);
create index payout_requests_creator_idx on public.payout_requests (creator_id, created_at desc);

-- Creators read their own; every write goes through the server (service role).
alter table public.payout_requests enable row level security;
create policy "payout_requests: creator read" on public.payout_requests
  for select to authenticated using (creator_id = (select auth.uid()));
