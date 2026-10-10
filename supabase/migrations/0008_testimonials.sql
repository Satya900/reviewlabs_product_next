-- =============================================================================
-- Testimonials shown on product pages. Creators add them in the page editor.
-- Avatar is either an uploaded photo (public "page-covers" bucket, under
-- "<creator id>/avatars/") or one of the built-in face illustrations.
-- =============================================================================

create table public.page_testimonials (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references public.payment_pages (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 80),
  comment      text not null check (char_length(trim(comment)) between 1 and 300),
  rating       smallint not null check (rating between 1 and 5),
  avatar_url   text,
  avatar_face  text not null default 'sunglasses',
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index page_testimonials_page_idx on public.page_testimonials (page_id, position);

alter table public.page_testimonials enable row level security;

create policy "testimonials: creator all" on public.page_testimonials
  for all to authenticated
  using (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())))
  with check (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())));

create policy "testimonials: public read live" on public.page_testimonials
  for select to anon, authenticated
  using (exists (select 1 from public.payment_pages p where p.id = page_id and p.status = 'live'));

-- At most 20 per page.
create or replace function public.enforce_testimonial_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.page_testimonials where page_id = new.page_id) >= 20 then
    raise exception 'testimonial_limit' using errcode = 'P0001', hint = 'A page can show up to 20 testimonials.';
  end if;
  return new;
end $$;

create trigger page_testimonials_limit before insert on public.page_testimonials
  for each row execute function public.enforce_testimonial_limit();
