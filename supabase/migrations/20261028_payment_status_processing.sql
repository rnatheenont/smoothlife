-- The staff payment webhook claims a transaction by moving it from `pending`
-- to `processing` in one filtered PATCH, so that two deliveries of the same
-- 2C2P callback cannot both pass a read-then-write check and both create a
-- Shopify order. Good design; the constraint never heard about it.
--
-- payment_transactions.status allowed pending/success/failed/refunded, so
-- every claim this webhook has ever made was rejected with 23514 and the
-- route logged "claim failed" and answered 200. 2C2P treats 200 as delivered
-- and does not retry. The result: an employee pays, 2C2P charges the card,
-- and the order sits at รอชำระ until it expires.
--
-- Found on 28 Oct 2026 with ฿978 already taken from one employee's card.
-- Not one staff order had ever reached `paid`.
alter table public.payment_transactions
  drop constraint if exists payment_transactions_status_check;

alter table public.payment_transactions
  add constraint payment_transactions_status_check
  check (status in ('pending', 'processing', 'success', 'failed', 'refunded'));
