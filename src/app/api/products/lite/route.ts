import { NextRequest, NextResponse } from "next/server";
import { products } from "@/data/products";
import { toCartProduct } from "@/data/cart-product";

// The handful of products a visitor actually has in their cart.
//
// This route exists so the catalogue can stop being shipped to the browser:
// the cart needs a name, a picture, a price and the list of sizes for each
// line, and it used to get them by searching a 650 KB array that every page
// downloaded. A cart has three or four lines in it.
//
// Read-only, no session, nothing but public catalogue data — the same facts
// the product page shows anyone. Prices here are for drawing the cart; what
// a customer is charged is resolved again from the variantId in
// /api/checkout/init, which never trusts a price sent from a browser.

/** A cart that large is a script, not a shopper. */
const MAX_SLUGS = 60;

export const dynamic = "force-dynamic";

// The catalogue is rebuilt once a day, so a minute at the edge is free and
// takes the repeat visits (every cart open, every tab) off the function.
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" };

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("slugs") ?? "";
  const slugs = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SLUGS);
  if (slugs.length === 0) return NextResponse.json({ products: [] }, { headers: CACHE_HEADERS });

  const wanted = new Set(slugs);
  // One pass over the catalogue rather than one search per slug: the array is
  // ~1,000 products and a cart can ask for sixty.
  const found = products.filter((p) => wanted.has(p.slug)).map(toCartProduct);

  return NextResponse.json({ products: found }, { headers: CACHE_HEADERS });
}
