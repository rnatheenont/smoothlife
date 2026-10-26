// What the payment methods themselves can carry, and which to offer.
//
// Its own module, not part of @/lib/2c2p, because the shop's own pages need
// the ceiling too: the checkout page and the flash-sale page tell the shopper
// which methods they are about to get. @/lib/2c2p reads the merchant
// credentials at module scope, so a "use client" file must never import from
// it — hence this split, which is the same shape as staff-sale /
// staff-sale-rpc. Nothing here touches the network or the environment, and
// the names of those credentials are deliberately not written here either:
// this file ships to the browser, and a bundle that greps positive for them
// costs somebody an afternoon proving it was only a comment.

/**
 * The most PromptPay QR will carry, in THB.
 *
 * Above this the QR standard itself refuses the transfer. 2C2P still shows
 * the method, so what the shopper gets is a dead end reached three clicks in:
 * nothing is charged, nothing is written back here, and the transaction row
 * stays `pending` for ever while they come back and try again.
 *
 * Not a guess — the ฿55,000 flash sale on 28–29 Sep 2026 is what this
 * number is made of. 46 of its 57 payment attempts died this way: 35 people,
 * no tranRef on any of them, one of them trying nine times across 23 hours.
 */
export const PROMPTPAY_QR_MAX_THB = 50_000;

/** Whether an amount can be paid by PromptPay QR at all. */
export function promptPayAvailable(amount: number): boolean {
  return amount <= PROMPTPAY_QR_MAX_THB;
}

/**
 * Which methods 2C2P should offer for an amount.
 *
 * Cards and PromptPay QR only. Left open, 2C2P offers twenty-nine methods —
 * every wallet, kiosk and direct-debit rail it carries — and a payment page
 * that asks a shopper to choose from twenty-nine things is a payment page
 * they leave. These two cover what this shop's customers actually use.
 *
 * Over PROMPTPAY_QR_MAX_THB a card is the only thing that can carry the
 * amount, so QR is left off the page rather than offered and then refused.
 * Every checkout route goes through here: the rule belongs to the amount,
 * not to whichever route happens to be asking.
 *
 * Channel codes are 2C2P's own (CC = all global card schemes, PPQR = Thai
 * PromptPay QR under the THQR group, not the generic "QR" code).
 */
export function paymentChannelsFor(amount: number): string[] {
  return promptPayAvailable(amount) ? ["CC", "PPQR"] : ["CC"];
}
