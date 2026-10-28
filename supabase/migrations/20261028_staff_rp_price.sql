-- The price list grew a step in the middle.
--
-- What the table called "ราคาปกติ" is the catalogue price, and the catalogue
-- price is the RP with 10% already on it. The staff discount is taken off the
-- RP, not off that — so the RP has to exist as its own number rather than
-- being re-derived every time somebody reads the screen.
--
-- Nullable on purpose: 387 rows already exist and nobody is going to type
-- them in this afternoon. Null means "work it out from the catalogue price"
-- (regular_price / 1.1), and a number means an admin has said otherwise.
alter table public.staff_round_items
  add column if not exists rp_price numeric(10, 2);

comment on column public.staff_round_items.rp_price is
  'RP before the 10% markup. Null = derive from regular_price / 1.1.';
