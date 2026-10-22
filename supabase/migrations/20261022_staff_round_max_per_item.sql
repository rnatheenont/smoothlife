-- "Nobody takes more than six of any one thing."
--
-- The price list already had a per-item limit, but it was a number to type
-- on every row — so the rule only held where somebody remembered it, and the
-- first round went live with nothing stopping a cart of nineteen.
--
-- This is the rule, set once on the round. A row may still carry its own
-- limit when something needs to be tighter; staff_create_order takes
-- whichever bites first, and `least` ignores nulls, so "no limit" on either
-- side simply defers to the other.
alter table public.staff_rounds
  add column if not exists max_per_item integer check (max_per_item > 0);

comment on column public.staff_rounds.max_per_item is
  'Blanket per-person limit per item for this round. Null = no blanket limit; staff_round_items.per_person_limit can still be stricter.';

-- How many times one person may buy in a round. One, by default.
--
-- The cap is a round's worth of shopping, not a balance to draw down over a
-- fortnight — and one order is also one parcel to pack. The number is on the
-- round so it can be relaxed without a deploy; null means no limit.
--
-- The older rule, one *unpaid* order at a time, stays: it is a different
-- thing (a cart holding an allowance) and it gives a better message.
alter table public.staff_rounds
  add column if not exists max_orders integer check (max_orders > 0);

comment on column public.staff_rounds.max_orders is
  'How many orders one person may place in this round, counting pending and paid. Null = no limit.';
