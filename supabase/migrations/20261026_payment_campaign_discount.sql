-- Where an Order Goal / Volume Discount campaign's money went.
--
-- Deliberately not reusing discount_code: that column holds a code the
-- shopper typed and Shopify quoted, and this one holds a campaign that fired
-- on its own. A refund has to be able to tell them apart, and so does anyone
-- asking at the end of a month what a campaign cost.

alter table public.payment_transactions
  add column if not exists campaign_discount_code text,
  add column if not exists campaign_discount_amount numeric not null default 0;

comment on column public.payment_transactions.campaign_discount_code is
  'Slug of the free_gift_promos row whose order discount applied, if any.';
