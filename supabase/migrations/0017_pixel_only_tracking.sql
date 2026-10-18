-- =============================================================================
-- Meta tracking with a Pixel ID alone. The Conversions API token becomes
-- optional: without it only browser events are sent; with it the server sends
-- the same events too (deduplicated by event ID).
-- =============================================================================

alter table public.page_pixel_settings alter column capi_token_encrypted drop not null;
