-- =============================================================================
-- Lifetime download access: download_grants.expires_at = NULL means it never
-- expires. Refunds still revoke access (expires_at = now()) and downloads are
-- only served for paid / partially refunded orders.
-- =============================================================================

alter table public.download_grants alter column expires_at drop not null;

-- Existing grants for orders that still have access become lifetime grants.
update public.download_grants dg
   set expires_at = null,
       max_downloads = greatest(dg.max_downloads, 50)
  from public.orders o
 where o.id = dg.order_id
   and o.status in ('paid', 'partially_refunded');

-- p_grant_ttl NULL => lifetime grant.
create or replace function public.mark_order_paid(
  p_razorpay_order_id    text,
  p_razorpay_payment_id  text,
  p_amount_paise         integer,
  p_fee_paise            integer,
  p_tax_paise            integer,
  p_method               text,
  p_raw                  jsonb,
  p_grant_ttl            interval,
  p_max_downloads        integer
)
returns table (order_id uuid, newly_paid boolean)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  o public.orders%rowtype;
  was_paid boolean;
begin
  select * into o from public.orders where razorpay_order_id = p_razorpay_order_id for update;
  if not found then
    -- Not one of ours (e.g. a payment link on the same Razorpay account).
    return;
  end if;
  if p_amount_paise <> o.amount_paise then
    raise exception 'amount mismatch for order %: expected %, got %', o.id, o.amount_paise, p_amount_paise;
  end if;

  insert into public.payments (order_id, razorpay_payment_id, status, method, amount_paise, fee_paise, tax_paise, raw)
  values (o.id, p_razorpay_payment_id, 'captured', p_method, p_amount_paise,
          coalesce(p_fee_paise, 0), coalesce(p_tax_paise, 0), coalesce(p_raw, '{}'::jsonb))
  on conflict (razorpay_payment_id) do update
    set status = 'captured',
        fee_paise = greatest(public.payments.fee_paise, excluded.fee_paise),
        tax_paise = greatest(public.payments.tax_paise, excluded.tax_paise),
        raw = excluded.raw;

  was_paid := o.status in ('paid', 'refunded', 'partially_refunded');

  if not was_paid then
    update public.orders
       set status = 'paid', paid_at = now(), razorpay_payment_id = p_razorpay_payment_id
     where id = o.id;

    insert into public.download_grants (order_id, token, expires_at, max_downloads)
    values (o.id, encode(gen_random_bytes(24), 'hex'),
            case when p_grant_ttl is null then null else now() + p_grant_ttl end,
            p_max_downloads)
    on conflict on constraint download_grants_order_id_key do nothing;
  end if;

  insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
  values (o.creator_id, o.id, 'sale', o.amount_paise, o.page_title, 'sale:' || p_razorpay_payment_id)
  on conflict (idempotency_key) do nothing;

  if coalesce(p_fee_paise, 0) > 0 then
    insert into public.ledger_entries (creator_id, order_id, entry_type, amount_paise, description, idempotency_key)
    values (o.creator_id, o.id, 'gateway_fee', -p_fee_paise, 'Razorpay fee (incl. GST)', 'fee:' || p_razorpay_payment_id)
    on conflict (idempotency_key) do nothing;
  end if;

  return query select o.id, not was_paid;
end $$;

create or replace function public.consume_download(p_token text, p_file_id uuid)
returns table (storage_path text, file_name text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  g public.download_grants%rowtype;
  f public.page_files%rowtype;
begin
  select dg.* into g from public.download_grants dg
   where dg.token = p_token
     and (dg.expires_at is null or dg.expires_at > now())
     and dg.download_count < dg.max_downloads
   for update;
  if not found then
    return;
  end if;

  select pf.* into f
    from public.page_files pf
    join public.orders o on o.page_id = pf.page_id
   where pf.id = p_file_id and o.id = g.order_id and o.status in ('paid', 'partially_refunded');
  if not found then
    return;
  end if;

  update public.download_grants set download_count = download_count + 1 where id = g.id;
  return query select f.storage_path, f.file_name;
end $$;

-- create or replace keeps existing grants, but re-assert them to be safe.
revoke all on function public.mark_order_paid(text, text, integer, integer, integer, text, jsonb, interval, integer) from public, anon, authenticated;
revoke all on function public.consume_download(text, uuid) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, text, integer, integer, integer, text, jsonb, interval, integer) to service_role;
grant execute on function public.consume_download(text, uuid) to service_role;
