import { NextRequest, NextResponse } from "next/server";
import { products } from "@/data/products";
import { getCollectionByHandle, getCollectionProducts } from "@/data/collections";
import { brands, brandProducts } from "@/data/brands";
import { toCardData } from "@/data/card";
import { toLiteProduct } from "@/data/cart-product";

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
  // A collection instead of a list of slugs: the flash-sale band on the
  // hand-written home page only learns which collection it is showing from
  // the widget row, in the browser. Same answer shape, chosen by handle.
  const collectionHandle = req.nextUrl.searchParams.get("collection");
  if (collectionHandle) {
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 10, MAX_SLUGS);
    const collection = getCollectionByHandle(collectionHandle);
    const cards = collection
      ? getCollectionProducts(collection)
          .filter((p) => p.inStock && p.image)
          .slice(0, limit)
          .map(toCardData)
      : [];
    return NextResponse.json({ title: collection?.title ?? null, cards }, { headers: CACHE_HEADERS });
  }

  // A shelf, by what it is a shelf of. The home page sends the first one as
  // props — the one that is on screen before anything is touched — and the
  // carousels ask for the rest as they are turned, so the page's HTML
  // carries ten cards instead of a hundred and fifty.
  const concern = req.nextUrl.searchParams.get("concern");
  const brandSlug = req.nextUrl.searchParams.get("brand");
  if (concern || brandSlug) {
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 10, MAX_SLUGS);
    const brand = brandSlug ? brands.find((b) => b.slug === brandSlug) : undefined;
    const pool = brand ? brandProducts(brand) : products.filter((p) => p.concerns.includes(concern as never));
    const cards = pool
      .filter((p) => p.inStock && p.image)
      .slice(0, limit)
      .map(toCardData);
    return NextResponse.json({ cards }, { headers: CACHE_HEADERS });
  }

  const raw = req.nextUrl.searchParams.get("slugs") ?? "";
  const slugs = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SLUGS);
  if (slugs.length === 0) return NextResponse.json({ products: [] }, { headers: CACHE_HEADERS });

  const wanted = new Set(slugs);
  // One pass over the catalogue rather than one search per slug: the array is
  // ~1,000 products and a cart can ask for sixty.
  const found = products.filter((p) => wanted.has(p.slug)).map(toLiteProduct);

  return NextResponse.json({ products: found }, { headers: CACHE_HEADERS });
}
