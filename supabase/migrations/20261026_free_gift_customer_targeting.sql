-- The targeting half of the app's "Custom Discount".
--
-- Its pitch is "cart rules joined with AND or OR" plus "target by customer
-- location or segment". The AND over cart rules is most of what this table
-- already does — a campaign's threshold, its scope and its exclusions all
-- have to hold at once — so what was actually missing is two things: a
-- second cart rule of a different kind, and who the shopper is.
--
-- Segments are the loyalty tiers this shop keeps, not an imported Shopify
-- segment list: those are the groups anyone here can name, and they are
-- already computed on every account. Location is left out on purpose — the
-- shop ships to one country.

alter table public.free_gift_promos
  add column if not exists customer_tiers text[] not null default '{}',
  add column if not exists first_order_only boolean not null default false,
  add column if not exists min_qty int;

alter table public.free_gift_promos
  drop constraint if exists free_gift_promos_min_qty_check;
alter table public.free_gift_promos
  add constraint free_gift_promos_min_qty_check
  check (min_qty is null or min_qty between 1 and 999);

comment on column public.free_gift_promos.customer_tiers is
  'Loyalty tiers this campaign is for. Empty = everyone.';
comment on column public.free_gift_promos.min_qty is
  'An extra condition ANDed with the main trigger: this many qualifying items.';
