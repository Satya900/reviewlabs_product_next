-- =============================================================================
-- Per-page Meta tracking. A page with its own Pixel ID + CAPI token sends all of
-- its events there; otherwise it falls back to the creator's account pixel.
-- Tokens are encrypted by the app, and the table is service-role only.
-- =============================================================================

create table public.page_pixel_settings (
  page_id               uuid primary key references public.payment_pages (id) on delete cascade,
  pixel_id              text not null check (pixel_id ~ '^\d{10,20}$'),
  capi_token_encrypted  text not null,
  test_event_code       text,
  updated_at            timestamptz not null default now()
);
create trigger page_pixel_settings_updated_at before update on public.page_pixel_settings
  for each row execute function public.set_updated_at();

alter table public.page_pixel_settings enable row level security;
-- No policies: only the service role (server) can read or write tokens.
