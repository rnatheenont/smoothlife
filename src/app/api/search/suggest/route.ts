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
const MAX_PRODUCTS = 20;
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" };

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 8, MAX_PRODUCTS);
  if (!q) return NextResponse.json({ brands: [], products: [] }, { headers: CACHE_HEADERS });

  const brandHits = brands
    .filter((b) => b.name.toLowerCase().includes(q))
    .slice(0, MAX_BRANDS)
    .map((b) => ({ slug: b.slug, name: b.name, image: b.image, productCount: b.productCount }));

  // The same three fields the box has always matched on, in the same order.
  const matches = products
    .filter(
      (p) =>
        p.inStock &&
        (p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.shortDesc.toLowerCase().includes(q))
    )
    .slice(0, limit)
    .map(toCardData);

  return NextResponse.json({ brands: brandHits, products: matches }, { headers: CACHE_HEADERS });
}
