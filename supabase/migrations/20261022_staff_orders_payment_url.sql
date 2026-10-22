-- Where to go back to, to finish paying.
--
-- An employee who closes the 2C2P tab has a pending order holding their
-- allowance for the rest of the payment window, and the only way back used
-- to be to cancel it and build the cart again. Re-issuing a payment token
-- instead would mean a second invoice for one order — and the first invoice
-- can still be paid, which is money arriving against an order that has
-- already moved on.
--
-- So the page's own URL is kept. 2C2P's payment page lives until
-- paymentExpiry, which is set to the order's own expiry, so the link dies
-- exactly when the hold does.
alter table public.staff_orders
  add column if not exists payment_url text;
