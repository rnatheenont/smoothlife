-- The app's "Order Goal" and "Volume Discount", which are not gift campaigns.
--
-- Both are the same ladder this table already stores — spend or buy this
-- much, reach this tier — with money off the order at the top of it instead
-- of a product. So they are a kind of reward rather than a new table: the
-- tiers, the trigger (baht or items), the scope, the exclusions and the
-- progress text are all the ones already written.

alter table public.free_gift_promos
  add column if not exists reward_type text not null default 'gift';

alter table public.free_gift_promos
  drop constraint if exists free_gift_promos_reward_type_check;
alter table public.free_gift_promos
  add constraint free_gift_promos_reward_type_check
  check (reward_type in ('gift', 'order_discount'));

comment on column public.free_gift_promos.reward_type is
  'gift = hands over a product. order_discount = takes a percentage or an amount off the order.';
