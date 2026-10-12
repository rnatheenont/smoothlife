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
export type SoldSync = { slug: string; queueSold: number; external: number; total: number };

/**
 * Reads what Shopify has sold for a campaign's products and writes the part
 * the queue does not know about into external_sold_count.
 *
 * Separated from the screens because the queue needs this whether anyone is
 * looking or not: fs_join reads the column, and if nothing refreshes it, a
 * sale made on the shop's own product page while the sale page sits unopened
 * stays invisible to the thing handing out slots. The cron calls this; the
 * status reads call it too, so an open page keeps it fresh for free.
 */
export async function syncExternalSold(campaignId: string, startsAt: string): Promise<SoldSync[]> {
  const rows = await supabaseRest<
    {
      id: string;
      product_slug: string;
      variant_id: string | null;
      total_stock: number;
      sold_count: number;
      external_sold_count: number;
    }[]
  >(
    `flash_sales?campaign_id=eq.${pgValue(campaignId)}` +
      `&select=id,product_slug,variant_id,total_stock,sold_count,external_sold_count`
  );
  if (!rows.length) return [];

  const sold = await variantsSoldSince(
    rows.map((r) => r.variant_id),
    startsAt
  );
  // Shopify unreachable, or nothing sold yet. Leaving the stored number alone
  // keeps the gate where it is rather than throwing it open.
  if (!sold.size) {
    return rows.map((r) => ({
      slug: r.product_slug,
      queueSold: r.sold_count,
      external: r.external_sold_count,
      total: r.total_stock,
    }));
  }

  const out: SoldSync[] = [];
  for (const row of rows) {
    const shopify = row.variant_id ? (sold.get(row.variant_id) ?? 0) : 0;

    // What Shopify knows that the queue does not. Shopify's figure counts
    // queue sales too — they are Shopify orders — so the queue's own count
    // comes off it, and an order our checkout has taken that Shopify has not
    // marked paid yet lands at zero rather than going negative.
    const external = Math.max(0, Math.min(shopify, row.total_stock) - row.sold_count);

    if (external !== row.external_sold_count) {
      // Written only when it moves, so a page polled every few seconds is not
      // also writing to the database every few seconds.
      await supabaseRest(`flash_sales?id=eq.${pgValue(row.id)}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ external_sold_count: external }),
      }).catch((err) => console.error("[flash-sale] could not store the storefront count", err));
    }

    out.push({ slug: row.product_slug, queueSold: row.sold_count, external, total: row.total_stock });
  }
  return out;
}

/**
 * Brings each product's sold count on screen up to date with Shopify, in
 * place, and stores the difference for the queue.
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
    const synced = await syncExternalSold(campaignId, startsAt);
    const bySlug = new Map(synced.map((s) => [s.slug, s]));
    for (const product of products) {
      const row = bySlug.get(product.slug);
      if (!row) continue;
      const total = row.queueSold + row.external;
      if (total > product.sold) product.sold = Math.min(total, product.total);
    }
  } catch (err) {
    console.error("[flash-sale] storefront sales count failed", err);
  }
}
