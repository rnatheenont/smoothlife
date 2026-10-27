-- How each campaign's widget looks, campaign by campaign.
--
-- The style editor was built against the single milestone_bar widget row,
-- which is how the app on Shopify does it too ("All settings here apply
-- globally to the one widget shown across your store"). But a shop running a
-- gentle evergreen giveaway next to a loud seven-day campaign wants them to
-- look different, and one global style cannot say that.
--
-- Null keeps the shop-wide default, so nothing moves for campaigns nobody
-- has restyled.

alter table public.free_gift_promos
  add column if not exists widget_style jsonb;

comment on column public.free_gift_promos.widget_style is
  'Per-campaign widget appearance. Null = use the shop-wide default.';
