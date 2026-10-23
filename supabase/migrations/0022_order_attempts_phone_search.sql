-- Phone search that ignores spaces, dashes and "+": adds buyer_phone_digits to
-- the order_attempts view (0021). Recreated because a view's columns can't be
-- reordered in place.

drop view if exists public.order_attempts;

create or replace view public.order_attempts with (security_invoker = true) as
select
  o.*,
  p.slug as page_slug,
  regexp_replace(o.buyer_phone, '\D', '', 'g') as buyer_phone_digits,
  case
    when o.status in ('paid', 'partially_refunded') then 'paid'
    when o.status = 'refunded' then 'refunded'
    when exists (
      select 1 from public.orders later
       where later.page_id = o.page_id
         and lower(later.buyer_email) = lower(o.buyer_email)
         and later.status in ('paid', 'partially_refunded', 'refunded')
         and later.created_at > o.created_at
    ) then 'paid_later'
    when exists (
      select 1 from public.orders later
       where later.page_id = o.page_id
         and lower(later.buyer_email) = lower(o.buyer_email)
         and later.created_at > o.created_at
    ) then 'retried'
    when o.status = 'failed' then 'failed'
    else 'abandoned'
  end as stage
from public.orders o
join public.payment_pages p on p.id = o.page_id;

-- Supabase gives new objects to anon by default; buyers never need this.
revoke all on public.order_attempts from anon;
grant select on public.order_attempts to authenticated;
