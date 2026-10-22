-- Optional "original price" on a product page, shown crossed out next to the
-- real price (e.g. ₹1,499 → ₹399). Used by the editor and by imports.
alter table public.payment_pages
  add column compare_at_paise integer
    check (compare_at_paise is null or (compare_at_paise > amount_paise and compare_at_paise <= 50000000));
