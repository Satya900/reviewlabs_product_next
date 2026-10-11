-- =============================================================================
-- Per-page FAQs. Each product page has its own questions and answers.
-- =============================================================================

create table public.page_faqs (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.payment_pages (id) on delete cascade,
  question    text not null check (char_length(trim(question)) between 1 and 150),
  answer      text not null check (char_length(trim(answer)) between 1 and 1000),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index page_faqs_page_idx on public.page_faqs (page_id, position);

alter table public.page_faqs enable row level security;

create policy "faqs: creator all" on public.page_faqs
  for all to authenticated
  using (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())))
  with check (exists (select 1 from public.payment_pages p where p.id = page_id and p.creator_id = (select auth.uid())));

create policy "faqs: public read live" on public.page_faqs
  for select to anon, authenticated
  using (exists (select 1 from public.payment_pages p where p.id = page_id and p.status = 'live'));

-- At most 20 per page.
create or replace function public.enforce_faq_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.page_faqs where page_id = new.page_id) >= 20 then
    raise exception 'faq_limit' using errcode = 'P0001', hint = 'A page can show up to 20 FAQs.';
  end if;
  return new;
end $$;

create trigger page_faqs_limit before insert on public.page_faqs
  for each row execute function public.enforce_faq_limit();
