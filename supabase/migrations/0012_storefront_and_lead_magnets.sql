-- =============================================================================
-- Link-in-bio storefront (reviewlabs.space/@handle) and lead magnets
-- (free products that collect a name and email instead of a payment).
-- =============================================================================

-- ---------------------------------------------------------------- storefront profile
alter table public.profiles
  add column handle            text unique check (handle ~ '^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])$'),
  add column avatar_url        text,
  add column bio               text not null default '' check (char_length(bio) <= 160),
  add column social_links      jsonb not null default '{}'::jsonb,
  add column featured_page_id  uuid references public.payment_pages (id) on delete set null;

-- Creators edit their own storefront fields (column-level grant, like payout details).
grant update (handle, avatar_url, bio, social_links, featured_page_id) on public.profiles to authenticated;

alter table public.payment_pages
  add column storefront_visible  boolean not null default true,
  add column storefront_position integer not null default 0,
  add column is_free             boolean not null default false;

-- Free pages have amount 0; paid pages keep Razorpay's ₹1 minimum.
alter table public.payment_pages drop constraint payment_pages_amount_paise_check;
alter table public.payment_pages add constraint payment_pages_amount_paise_check
  check ((is_free and amount_paise = 0) or (not is_free and amount_paise >= 100));

-- Lead magnet claims are ₹0 orders.
alter table public.orders drop constraint orders_amount_paise_check;
alter table public.orders add constraint orders_amount_paise_check check (amount_paise >= 0);
create index orders_page_email_idx on public.orders (page_id, lower(buyer_email));

-- ---------------------------------------------------------------- claim a free product
-- Creates (or reuses) a ₹0 order for a live free page and its download link.
-- The same email claiming the same page again gets their existing order back.
create or replace function public.claim_free_product(
  p_page_id        uuid,
  p_name           text,
  p_email          text,
  p_phone          text,
  p_responses      jsonb,
  p_tracking       jsonb,
  p_grant_ttl      interval,
  p_max_downloads  integer
)
returns table (order_id uuid, newly_created boolean)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  pg public.payment_pages%rowtype;
  existing uuid;
  new_id uuid;
begin
  select * into pg from public.payment_pages where id = p_page_id and status = 'live' and is_free;
  if not found then
    raise exception 'not_a_free_page';
  end if;

  select o.id into existing from public.orders o
   where o.page_id = p_page_id and lower(o.buyer_email) = lower(p_email) and o.status = 'paid'
   order by o.created_at limit 1;
  if existing is not null then
    return query select existing, false;
    return;
  end if;

  insert into public.orders (page_id, creator_id, page_title, buyer_name, buyer_email, buyer_phone,
                             form_responses, amount_paise, list_price_paise, status, tracking, paid_at)
  values (pg.id, pg.creator_id, pg.title, p_name, lower(p_email), coalesce(p_phone, ''),
          coalesce(p_responses, '{}'::jsonb), 0, 0, 'paid', coalesce(p_tracking, '{}'::jsonb), now())
  returning id into new_id;

  insert into public.download_grants (order_id, token, expires_at, max_downloads)
  values (new_id, encode(gen_random_bytes(24), 'hex'),
          case when p_grant_ttl is null then null else now() + p_grant_ttl end,
          p_max_downloads);

  return query select new_id, true;
end $$;

revoke all on function public.claim_free_product(uuid, text, text, text, jsonb, jsonb, interval, integer) from public, anon, authenticated;
grant execute on function public.claim_free_product(uuid, text, text, text, jsonb, jsonb, interval, integer) to service_role;
