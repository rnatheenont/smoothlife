// Where a refund for this payment actually has to happen.
//
// Two different checkouts write to payment_transactions, and only one of them
// leaves Shopify able to reverse the charge:
//
//  * Shopify's own checkout (the flash-sale queue — see flash-sale-shopify.ts,
//    which writes the order name, "#4371", into tran_ref). Shopify holds the
//    real payment, so refunding there moves the customer's money.
//
//  * our own 2C2P checkout (the webhooks write the gateway's numeric tranRef).
//    Shopify only holds a *manual* transaction labelled "2C2P" — a note, not a
//    connection. Refunding that order marks it refunded and moves nothing, and
//    2C2P's refund API is refused from these servers, so the merchant portal is
//    the only place the money can go back.
//
// Three live orders were refunded in Shopify on the second kind and left ฿2,711
// owed to customers who had been told they were paid, which is why this
// classification is now in front of every refund control instead of in a
// comment. Anything unreadable counts as "portal": assuming Shopify can pay
// when it cannot is the mistake that costs a customer money.

export type RefundRoute = "shopify" | "portal";

export function refundRouteFor(tranRef: string | null | undefined): RefundRoute {
  return tranRef?.trim().startsWith("#") ? "shopify" : "portal";
}

export const REFUND_ROUTE_LABEL: Record<RefundRoute, string> = {
  shopify: "คืนได้ใน Shopify",
  portal: "ต้องคืนใน 2C2P portal",
};
