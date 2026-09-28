import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { variantsSoldSince } from "@/lib/shopify-admin";

// What a campaign has actually sold.
//
// The queue knows what the queue sold. On a "25 sets only" campaign those are
// the same twenty-five as the ones the storefront sells beside it — and two of
// these went out of the shop's own front door minutes after the sale opened,
// while every screen we have still read zero.
//
// One copy, because three screens ask the question: the customer's sale page,
// the console's live monitor, and the batched monitor the campaign list polls.
// Two of them showing different numbers for the same sale is worse than
// either number being slightly stale.

type Counted = { slug: string; sold: number; total: number };

/**
 * Raises each product's sold count to Shopify's, in place.
 *
 * Only ever raises: an order our own checkout has just taken may not have
 * reached Shopify yet, and a number that goes backwards in the middle of a
 * drop is worse than one that is briefly low. Fails quietly — the queue's own
 * count stands rather than the screen failing to load.
 */
export async function raiseSoldToShopify(
  campaignId: string,
  startsAt: string,
  products: Counted[]
): Promise<void> {
  if (!products.length) return;
  try {
    const rows = await supabaseRest<{ product_slug: string; variant_id: string | null }[]>(
      `flash_sales?campaign_id=eq.${pgValue(campaignId)}&select=product_slug,variant_id`
    );
    const sold = await variantsSoldSince(
      rows.map((r) => r.variant_id),
      startsAt
    );
    if (!sold.size) return;

    const variantOf = new Map(rows.map((r) => [r.product_slug, r.variant_id]));
    for (const product of products) {
      const variant = variantOf.get(product.slug);
      const shopify = variant ? (sold.get(variant) ?? 0) : 0;
      if (shopify > product.sold) product.sold = Math.min(shopify, product.total);
    }
  } catch (err) {
    console.error("[flash-sale] storefront sales count failed", err);
  }
}
