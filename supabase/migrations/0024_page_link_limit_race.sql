-- Tightens the 10-links-per-product limit from 0023 (found in code review):
-- * two links added at the same moment could both see 9 and make 11, so the
--   check now locks the product row first, making concurrent adds wait;
-- * moving a link to another product (UPDATE of page_id) is checked too.

create or replace function public.enforce_page_link_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.page_id = old.page_id then
    return new;
  end if;
  perform 1 from public.payment_pages where id = new.page_id for update;
  if (select count(*) from public.page_links where page_id = new.page_id and id <> new.id) >= 10 then
    raise exception 'page_link_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists page_links_limit on public.page_links;
create trigger page_links_limit before insert or update of page_id on public.page_links
  for each row execute function public.enforce_page_link_limit();
