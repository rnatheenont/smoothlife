import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { amountsFromLineItems, withinCampaign, type CampaignRules } from "@/lib/receipt-campaign";
import { loadCampaignContent, windowOf } from "@/lib/receipt-campaign-content";
import { orderPaymentByGid } from "@/lib/shopify-admin";

// Which of a customer's orders this campaign will take a receipt for.
//
// One copy, because there were two: the page that lists the orders and the
// endpoint that reads the photo each decided eligibility for themselves, and
// they had already drifted — one passed the campaign's rules to the amount
// calculation and the other used the defaults. Two answers to "is this order
// in the campaign" is one answer too many.

export type CampaignOrder = {
  id: string;
  invoice_no: string;
  amount: number;
  confirmed_at: string | null;
  line_items: { variantId: string; quantity: number; price: number }[] | null;
  shopify_order_id: string | null;
};

/** Shopify's word for an order that is not going to be honoured. */
const UNPAID = new Set(["REFUNDED", "VOIDED", "EXPIRED"]);

/**
 * Every order of this customer that the campaign would accept a receipt for.
 *
 * Three tests, and each one is a thing the customer would otherwise be
 * invited to do and then refused for:
 *
 *  - inside the window, which the campaign's own settings decide;
 *  - carrying something the campaign counts — Dentiste, a keychain set, or
 *    both. Not "Dentiste above zero": once a keychain set is named in the
 *    rules its line stops counting as Dentiste, and an order that is nothing
 *    but the ฿990 set is worth three entries and would have been thrown out
 *    here for having no Dentiste in it;
 *  - not refunded. Our row says a card cleared, which is not the same as "the
 *    shop is keeping the money" — an admin cannot approve a refunded order, so
 *    offering it is an invitation to waste a photo and a review.
 *
 * The refund test fails open: Shopify being unreachable is not a reason to
 * tell a customer their order does not exist, and the approval screen checks
 * the live status again before anything is awarded.
 */
export async function eligibleOrders(
  campaignKey: string,
  userId: string,
  anyOrder = false
): Promise<{ rules: CampaignRules; orders: CampaignOrder[] }> {
  const [rows, content] = await Promise.all([
    supabaseRest<CampaignOrder[]>(
      `payment_transactions?user_id=eq.${pgValue(userId)}&status=eq.success` +
        `&select=id,invoice_no,amount,confirmed_at,line_items,shopify_order_id&order=confirmed_at.desc&limit=100`
    ).catch(() => [] as CampaignOrder[]),
    loadCampaignContent(campaignKey),
  ]);
  const window = windowOf(content);

  const counted = rows.filter((tx) => {
    if (!withinCampaign(tx.confirmed_at, anyOrder, window)) return false;
    const amounts = amountsFromLineItems(tx.line_items, content.rules);
    return amounts.dentisteAmount > 0 || amounts.keychainAmount > 0;
  });

  const payments = await orderPaymentByGid(counted.map((tx) => tx.shopify_order_id)).catch(() => new Map());
  return {
    rules: content.rules,
    orders: counted.filter((tx) => {
      const status = payments.get(tx.shopify_order_id ?? "")?.financialStatus;
      return !status || !UNPAID.has(status.toUpperCase());
    }),
  };
}
