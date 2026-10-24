-- Products delivered as links (a Notion template, Google Drive folder, Canva
-- link, course login, Telegram or WhatsApp group invite), alongside or instead
-- of files. Buyers get them after payment, on the thank-you page, in the
-- receipt email and on their lifetime downloads page.
--
-- The URL is the product, so it's never readable publicly: creators manage
-- their own pages' links, and delivery reads them with the service role only
-- for paid orders.

create table public.page_links (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.payment_pages (id) on delete cascade,
  label       text not null check (char_length(trim(label)) between 1 and 80),
  url         text not null check (url ~ '^https://[^\s]+$' and char_length(url) <= 2000),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index page_links_page_idx on public.page_links (page_id, position, created_at);

alter table public.page_links enable row level security;

create policy "page_links: creator all" on public.page_links
  for all to authenticated
  using (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())))
  with check (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())));

-- At most 10 links per product.
create or replace function public.enforce_page_link_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.page_links where page_id = new.page_id) >= 10 then
    raise exception 'page_link_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger page_links_limit before insert on public.page_links
  for each row execute function public.enforce_page_link_limit();

revoke all on public.page_links from anon;
