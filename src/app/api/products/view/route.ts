import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { getProductDetail } from "@/data/product-details";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

// "Somebody opened this product."
//
// The one signal the shop never collected. search_queries records the words
// people type and nothing about where they went next, so until now "which
// products are customers interested in" could only be answered with what the
// shop chose to promote — badges and discount depth — which is the shop
// talking about itself.
//
// Public and unauthenticated, like the search logger beside it, and written to
// the same brief: one number goes up, nothing about who looked is stored, and
// a flood costs a counter rather than a table.
export const dynamic = "force-dynamic";

/**
 * Per address, per minute. Generous for a person — opening twenty products a
 * minute is a determined browser and should count — and far under a script.
 * In-memory rather than the shared limiter: this fires on ordinary page views,
 * and a durable limiter would add two Supabase round trips to every one of
 * them to guard a write worth a single integer.
 */
const PER_IP_PER_MINUTE = 60;

export async function POST(req: NextRequest) {
  // Always 200. The shopper is reading a product page; nothing that happens
  // here is theirs to deal with, and a visible failure would be the only
  // consequence they could possibly notice.
  if (!supabaseConfigured()) return NextResponse.json({ ok: true });
  if (isRateLimited(`product-view:${clientIp(req)}`, PER_IP_PER_MINUTE, 60_000)) {
    return NextResponse.json({ ok: true });
  }

  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.slice(0, 200) : "";
  // Checked against the catalogue, not just for shape. The slug becomes a
  // primary key, so without this anyone could grow the table by one row per
  // made-up word — and a ranking table full of products that do not exist is
  // harder to notice than a broken page.
  //
  // product-details, which is the same catalogue the product page consults to
  // decide whether to render or 404, rather than the abridged one the browser
  // gets. A build writes both from one fetch so they agree, but "the page
  // existed" is the thing actually being asserted here.
  if (!slug || !getProductDetail(slug)) return NextResponse.json({ ok: true });

  try {
    await supabaseRest("rpc/record_product_view", {
      method: "POST",
      returning: false,
      body: JSON.stringify({ p_slug: slug }),
    });
  } catch (err) {
    console.error("[products/view] could not record view", err);
  }
  return NextResponse.json({ ok: true });
}
