-- =============================================================================
-- Rich text product descriptions.
-- description_html holds sanitised HTML from the editor; description keeps a
-- plain-text copy for search engines, link previews and emails.
-- Images inside descriptions use the existing public "page-covers" bucket under
-- "<creator id>/media/", which the creator-folder storage policies already cover.
-- =============================================================================

alter table public.payment_pages
  add column description_html text not null default '' check (char_length(description_html) <= 200000);

-- Carry existing plain descriptions over as escaped paragraphs.
update public.payment_pages
   set description_html =
     '<p>' ||
     replace(
       replace(replace(replace(description, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
       E'\n', '<br>'
     ) || '</p>'
 where description <> '' and description_html = '';
