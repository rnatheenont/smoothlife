-- Which tiers of a tiered promo actually pay out.
--
-- This table has always paid every tier the basket reached: ฿1,599 on a
-- two-tier ladder handed over the ฿699 gifts and the ฿1,599 gifts both. The
-- app the shop runs today does not — its orders show the top tier reached and
-- nothing below it, and a shop replacing that app with this one has to be
-- able to say so rather than quietly giving more away.
--
-- Defaults to what the table already did, so no existing row changes.
alter table free_gift_promos
  add column if not exists tier_mode text not null default 'cumulative';

alter table free_gift_promos
  drop constraint if exists free_gift_promos_tier_mode_check;

alter table free_gift_promos
  add constraint free_gift_promos_tier_mode_check
  check (tier_mode in ('cumulative', 'highest'));

comment on column free_gift_promos.tier_mode is
  'How a tiered promo pays out. cumulative: every tier reached hands over its gifts (the behaviour this table has always had). highest: only the top tier reached does, which is what the AOV app on Shopify does today.';
