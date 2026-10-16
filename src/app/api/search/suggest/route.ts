import { NextRequest, NextResponse } from "next/server";
import { products } from "@/data/products";
import { brands } from "@/data/brands";
import { toCardData } from "@/data/card";

// What the search box offers while someone is typing.
//
// It used to be a filter over the whole catalogue in the browser, which is
// why every page — the search box is in the header — downloaded ~650 KB of
// products. The matching is the same; it happens here now.
//
// Public catalogue data, no session. Edge-cached per query: the same few
// hundred words are typed over and over, and a repeat costs nothing.

const MAX_BRANDS = 3;
/** One request's worth. The dropdown asks for eight; the search page pages
 *  through with `offset` rather than being handed the whole catalogue. */
const MAX_PRODUCTS = 48;
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" };

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 8, MAX_PRODUCTS);
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);
  if (!q) return NextResponse.json({ brands: [], products: [], total: 0 }, { headers: CACHE_HEADERS });

  const brandHits = brands
    .filter((b) => b.name.toLowerCase().includes(q))
    .slice(0, MAX_BRANDS)
    .map((b) => ({ slug: b.slug, name: b.name, image: b.image, productCount: b.productCount }));

  // The same three fields the box has always matched on, in the same order.
  //
  // Sold-out products are part of the answer now. Hiding them made a search
  // for a brand report half its range — thirty-three of P&F's sixty-three —
  // and a shopper looking for something specific would rather be told it is
  // out of stock than told it does not exist. The card already draws that
  // state. They sort to the back so they can never push a buyable product
  // off the first page.
  const all = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.shortDesc.toLowerCase().includes(q)
    )
    .sort((a, b) => Number(b.inStock) - Number(a.inStock));
  const matches = all.slice(offset, offset + limit).map(toCardData);

  // `total` is counted before the slice, so the page can say how many were
  // found rather than how many fitted in one response — the old answer, which
  // stopped at twenty however many there really were.
  return NextResponse.json(
    { brands: brandHits, products: matches, total: all.length },
    { headers: CACHE_HEADERS }
  );
}
