-- A promo, or one tier of it, can hand over more than one thing.
--
-- The shop already runs a campaign like that — the ฿1,599 tier of the AOV app
-- gives four items at once — and the table could not hold it: one gift per
-- promo, one gift per tier, in three columns that assume a single answer.
--
-- The list is additive. `gifts` is read when it has anything in it, and the
-- old gift_product_slug / gift_variant_id / gift_qty columns answer when it
-- does not, so every row written before today keeps working untouched and
-- nothing has to be backfilled.
--
-- Shape of each entry, matching the three columns it replaces:
--   { "variant_id": "gid://shopify/ProductVariant/…",
--     "product_slug": "…",     -- optional, for gifts that are in the catalogue
--     "qty": 1 }
--
-- Tiers keep living in the `tiers` jsonb and gain the same optional key, so a
-- tier reads { "min_subtotal": 1599, "gifts": [ … ] }.

alter table free_gift_promos
  add column if not exists gifts jsonb;

comment on column free_gift_promos.gifts is
  'Optional list of gifts, used instead of gift_product_slug/gift_variant_id/gift_qty when non-empty. Entries: { variant_id, product_slug?, qty }.';
