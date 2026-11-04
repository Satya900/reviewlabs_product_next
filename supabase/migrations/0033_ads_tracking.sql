-- Reviewlabs' own ads: which ad brought each creator, and the conversions we
-- send to our Meta pixel (signups and first plan payments). Creators' pages
-- stay untracked; this is only about creators signing up and paying us.

-- UTM tags and the Meta click (_fbc/_fbp) from the browser that signed up.
-- Written by the server at signup; read by the admin panel and by the server
-- when it reports the creator's first payment.
alter table public.profiles add column signup_attribution jsonb;

-- One row per conversion sent to Meta. The unique key lets the first caller
-- claim an event, so Checkout and the webhook never both send it.
create table public.platform_events (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid references public.profiles(id) on delete cascade,
  event_name  text not null check (event_name in ('CompleteRegistration', 'Subscribe')),
  event_id    text not null check (char_length(event_id) <= 100),
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  last_error  text,
  response    jsonb,
  created_at  timestamptz not null default now(),
  unique (event_name, event_id)
);
-- Server only (service role); no policies.
alter table public.platform_events enable row level security;
