-- Everything the app on Shopify can express and this table could not.
--
-- Read off the app's own editor (AOV.ai Free Gift & BXGY → campaign 1538937847959)
-- rather than guessed: the campaign setting step offers a reward type of cart
-- value OR product quantity, sub-conditions that exclude products and limit
-- which collections count, and a discount type per milestone that is not
-- always "free".
--
-- Mapping note: the app scopes campaigns by Shopify collection. This shop's
-- cart lines carry brand and category, not collection membership, so the scope
-- is written in those terms instead of importing a collection list we would
-- then have to keep in step with Shopify forever.

alter table public.free_gift_promos
  -- Lines that do not count toward the threshold. The live Free-gift-orders
  -- campaign uses this to stop a gift paying for itself.
  add column if not exists excluded_product_slugs text[] not null default '{}',
  -- Only these brands / categories count. Empty means the whole catalogue —
  -- the app's "Include collection" condition.
  add column if not exists scope_brands text[] not null default '{}',
  add column if not exists scope_categories text[] not null default '{}',
  -- At most this many of the listed gifts are handed over. Null means all of
  -- them, which is what every promo written before this did.
  add column if not exists max_gifts int,
  -- Whether the threshold counts money or items.
  add column if not exists trigger_type text not null default 'cart-value';

alter table public.free_gift_promos
  drop constraint if exists free_gift_promos_trigger_type_check;
alter table public.free_gift_promos
  add constraint free_gift_promos_trigger_type_check
  check (trigger_type in ('cart-value', 'quantity'));

alter table public.free_gift_promos
  drop constraint if exists free_gift_promos_max_gifts_check;
alter table public.free_gift_promos
  add constraint free_gift_promos_max_gifts_check
  check (max_gifts is null or max_gifts between 1 and 10);

comment on column public.free_gift_promos.excluded_product_slugs is
  'Catalogue slugs whose lines do not count toward the threshold.';
comment on column public.free_gift_promos.trigger_type is
  'cart-value: the threshold is money. quantity: it is a number of items.';
comment on column public.free_gift_promos.max_gifts is
  'Cap on how many of the listed gifts are handed over. Null = all of them.';
