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
 * Brings each product's sold count up to date with Shopify, in place, and
 * writes the difference down so the queue can see it too.
 *
 * The screens were the easy half. The hard half is that fs_join decides
 * whether anyone else may queue, and it reads the database — so a sale made
 * on the shop's own product page was invisible to the thing handing out
 * slots. On the VIP set campaign the queue would have admitted fifteen more
 * people for thirteen remaining sets.
 *
 * Shopify is not called from inside the database for that decision, and must
 * not be: fs_join holds a lock on the row while hundreds of people press the
 * button at once, and an HTTP call parked in there stops the whole queue. So
 * the count is read out here and stored in external_sold_count, which
 * fs_join, fs_settle_locked and fs_status all add to sold_count.
 *
 * Fails quietly — the queue's own count stands rather than the page failing
 * to load, which leaves the gate stricter than reality rather than looser.
 */
export async function raiseSoldToShopify(
  campaignId: string,
  startsAt: string,
  products: Counted[]
): Promise<void> {
  if (!products.length) return;
  try {
    const rows = await supabaseRest<
      { id: string; product_slug: string; variant_id: string | null; sold_count: number; external_sold_count: number }[]
    >(`flash_sales?campaign_id=eq.${pgValue(campaignId)}&select=id,product_slug,variant_id,sold_count,external_sold_count`);
    const sold = await variantsSoldSince(
      rows.map((r) => r.variant_id),
      startsAt
    );
    if (!sold.size) return;

    const byProduct = new Map(products.map((p) => [p.slug, p]));
    for (const row of rows) {
      const product = byProduct.get(row.product_slug);
      if (!product) continue;
      const shopify = row.variant_id ? (sold.get(row.variant_id) ?? 0) : 0;

      // What Shopify knows that the queue does not. Shopify's figure counts
      // queue sales too — they are Shopify orders — so the queue's own count
      // comes off it, and an order our checkout has taken that Shopify has
      // not marked paid yet simply lands at zero rather than going negative.
      const external = Math.max(0, Math.min(shopify, product.total) - row.sold_count);

      if (external !== row.external_sold_count) {
        // Written only when it moves, so a page that is polled every few
        // seconds is not also writing every few seconds.
        await supabaseRest(`flash_sales?id=eq.${pgValue(row.id)}`, {
          method: "PATCH",
          returning: false,
          body: JSON.stringify({ external_sold_count: external }),
        }).catch((err) => console.error("[flash-sale] could not store the storefront count", err));
      }

      const total = row.sold_count + external;
      if (total > product.sold) product.sold = Math.min(total, product.total);
    }
  } catch (err) {
    console.error("[flash-sale] storefront sales count failed", err);
  }
}
