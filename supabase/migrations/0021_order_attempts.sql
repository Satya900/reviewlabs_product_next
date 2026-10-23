-- Payments list for follow-ups: every checkout with a "stage" that says what
-- happened, so creators can contact buyers who didn't finish without chasing
-- people who paid later.
--
-- stage:
--   paid        paid (or partly refunded)
--   refunded    fully refunded
--   paid_later  didn't finish, but the same buyer paid for this page afterwards
--   retried     didn't finish and tried again later (the later attempt is the one to follow up)
--   failed      the latest attempt, and the payment failed
--   abandoned   the latest attempt, filled the form but never paid
--
-- security_invoker: the view runs with the caller's rights, so the orders RLS
-- policy (creators see only their own) still applies.

create or replace view public.order_attempts with (security_invoker = true) as
select
  o.*,
  p.slug as page_slug,
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

-- Speeds up the "same buyer, same page, later" checks above.
create index if not exists orders_page_buyer_idx on public.orders (page_id, lower(buyer_email), created_at);
