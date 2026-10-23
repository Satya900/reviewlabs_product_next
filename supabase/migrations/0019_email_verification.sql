-- Instant signup: creators get into the dashboard straight away and verify
-- their email afterwards. Until they do, they can build but not sell: pages and
-- lead magnets can't go live, and no payouts are sent.
--
-- Supabase's own email_confirmed_at is set at signup now (accounts are created
-- confirmed so the password works immediately), so verification is tracked here.
-- Only the server (service role) can set it: creators have no update grant on it.

alter table public.profiles add column email_verified_at timestamptz;

-- Everyone who could log in until now had already confirmed their email.
update public.profiles p
   set email_verified_at = u.email_confirmed_at
  from auth.users u
 where u.id = p.id
   and u.email_confirmed_at is not null
   and p.email_verified_at is null;

-- Going live needs a verified email (admins are exempt).
create or replace function public.enforce_verified_to_publish()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    if not exists (
      select 1 from public.profiles
       where id = new.creator_id and (email_verified_at is not null or is_admin)
    ) then
      raise exception 'email_not_verified' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger payment_pages_verified_to_publish
  before insert or update of status on public.payment_pages
  for each row execute function public.enforce_verified_to_publish();

create trigger lead_magnets_verified_to_publish
  before insert or update of status on public.lead_magnets
  for each row execute function public.enforce_verified_to_publish();
