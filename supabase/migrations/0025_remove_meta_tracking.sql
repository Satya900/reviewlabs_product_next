-- Meta Pixel and Conversions API are gone: creators' pixels, Reviewlabs' own
-- pixel and the event log. Sales analytics are built in (page_views_daily,
-- orders). Drops the saved pixel IDs and encrypted Conversions API tokens, and
-- strips the Meta cookies (_fbp, _fbc) kept with past orders and leads.

drop table if exists public.page_pixel_settings;
drop table if exists public.creator_pixel_settings;
drop table if exists public.meta_events;

update public.orders set tracking = tracking - 'fbp' - 'fbc' where tracking ? 'fbp' or tracking ? 'fbc';
update public.lead_responses set tracking = tracking - 'fbp' - 'fbc' where tracking ? 'fbp' or tracking ? 'fbc';
