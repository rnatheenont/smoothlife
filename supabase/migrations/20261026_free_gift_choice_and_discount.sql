-- Two more of the app's settings, read off its own editor.
--
-- "Free gift selection method" has two modes: the gift is added automatically,
-- or the shopper picks which of the rewards they want. And a milestone's
-- "Discount type" is a dropdown — Free is only its first entry, so a reward
-- can be a percentage off or a fixed price instead of a giveaway.

alter table public.free_gift_promos
  add column if not exists gift_choice text not null default 'auto',
  add column if not exists discount_type text not null default 'free',
  add column if not exists discount_value numeric not null default 0;

alter table public.free_gift_promos
  drop constraint if exists free_gift_promos_gift_choice_check;
alter table public.free_gift_promos
  add constraint free_gift_promos_gift_choice_check
  check (gift_choice in ('auto', 'customer'));

alter table public.free_gift_promos
  drop constraint if exists free_gift_promos_discount_type_check;
alter table public.free_gift_promos
  add constraint free_gift_promos_discount_type_check
  check (discount_type in ('free', 'percentage', 'fixed'));

alter table public.free_gift_promos
  drop constraint if exists free_gift_promos_discount_value_check;
alter table public.free_gift_promos
  add constraint free_gift_promos_discount_value_check
  check (
    discount_value >= 0
    and (discount_type <> 'percentage' or discount_value <= 100)
  );

comment on column public.free_gift_promos.gift_choice is
  'auto = added automatically; customer = the shopper picks up to max_gifts of the listed rewards.';
comment on column public.free_gift_promos.discount_type is
  'free = the reward costs nothing. percentage/fixed price it against the product''s retail price.';
