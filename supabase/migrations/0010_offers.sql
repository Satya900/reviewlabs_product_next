-- =============================================================================
-- Additional offer (order bump): one optional custom add-on per product page,
-- with its own title, image, pitch, price and files. Buyers tick it at checkout
-- and pay for both in a single Razorpay payment. Creator plan feature.
-- =============================================================================

create table public.page_offers (
  id                uuid primary key default gen_random_uuid(),
  page_id           uuid not null unique references public.payment_pages (id) on delete cascade,
  headline          text not null default 'Yes, add this to my order' check (char_length(headline) between 1 and 80),
  title             text not null check (char_length(trim(title)) between 1 and 120),
  description       text not null default '' check (char_length(description) <= 300),
  image_url         text,
  price_paise       integer not null check (price_paise >= 100),
  compare_at_paise  integer check (compare_at_paise is null or compare_at_paise > 0),
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger page_offers_updated_at before update on public.page_offers
  for each row execute function public.set_updated_at();

-- Files delivered when the offer is bought (private bucket, like page_files).
create table public.offer_files (
  id            uuid primary key default gen_random_uuid(),
  offer_id      uuid not null references public.page_offers (id) on delete cascade,
  storage_path  text not null unique,
  file_name     text not null,
  size_bytes    bigint not null default 0,
  content_type  text,
  created_at    timestamptz not null default now()
);
create index offer_files_offer_idx on public.offer_files (offer_id);

alter table public.page_offers enable row level security;
alter table public.offer_files enable row level security;

create policy "offers: creator all" on public.page_offers
  for all to authenticated
  using (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())))
  with check (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())));

create policy "offers: public read active on live pages" on public.page_offers
  for select to anon, authenticated
  using (active and exists (select 1 from public.payment_pages p where p.id = page_id and p.status = 'live'));

create policy "offer files: creator all" on public.offer_files
  for all to authenticated
  using (exists (
    select 1 from public.page_offers o join public.payment_pages p on p.id = o.page_id
     where o.id = offer_id and p.creator_id = (select auth.uid())))
  with check (
    exists (
      select 1 from public.page_offers o join public.payment_pages p on p.id = o.page_id
       where o.id = offer_id and p.creator_id = (select auth.uid()))
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );

-- What the buyer added to the order. amount_paise stays the total charged.
alter table public.orders
  add column offer_id          uuid references public.page_offers (id) on delete set null,
  add column offer_title       text,
  add column offer_price_paise integer not null default 0 check (offer_price_paise >= 0);

-- Downloads: a link covers the main product's files and the bought offer's files.
create or replace function public.consume_download(p_token text, p_file_id uuid)
returns table (storage_path text, file_name text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  g public.download_grants%rowtype;
  path text;
  fname text;
begin
  select dg.* into g from public.download_grants dg
   where dg.token = p_token
     and (dg.expires_at is null or dg.expires_at > now())
     and dg.download_count < dg.max_downloads
   for update;
  if not found then
    return;
  end if;

  select pf.storage_path, pf.file_name into path, fname
    from public.page_files pf
    join public.orders o on o.page_id = pf.page_id
   where pf.id = p_file_id and o.id = g.order_id and o.status in ('paid', 'partially_refunded');

  if path is null then
    select ofl.storage_path, ofl.file_name into path, fname
      from public.offer_files ofl
      join public.orders o on o.offer_id = ofl.offer_id
     where ofl.id = p_file_id and o.id = g.order_id and o.status in ('paid', 'partially_refunded');
  end if;

  if path is null then
    return;
  end if;

  update public.download_grants set download_count = download_count + 1 where id = g.id;
  return query select path, fname;
end $$;

revoke all on function public.consume_download(text, uuid) from public, anon, authenticated;
grant execute on function public.consume_download(text, uuid) to service_role;
