import { NextRequest, NextResponse } from "next/server";
import { toCardData } from "@/data/card";
import { filterProducts, PAGE_SIZE, type ShopSearchParams } from "@/lib/filter-products";
import { withCustomImages } from "@/lib/product-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One page of the shop grid, for the scroll loader.
//
// The filtering lives on the server because the thing being filtered is the
// 3 MB catalogue, which must never reach a browser — so "load the next page"
// cannot be arithmetic in the client, it has to be a request. This is the
// same filterProducts the page itself runs, sliced the same way, so page 2
// fetched here and page 2 rendered by the server are the same twenty-four
// products in the same order.
//
// Cards only. ProductRow wants the full Product and the full Product is what
// the catalogue is heavy with; the list view keeps its pages instead, which
// is also the view somebody uses when they are comparing rather than
// browsing.

export async function GET(req: NextRequest) {
  const params: ShopSearchParams = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    if (value) (params as Record<string, string>)[key] = value;
  });

  const all = filterProducts(params);
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), totalPages);
  const slice = await withCustomImages(all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));

  return NextResponse.json({
    ok: true,
    page,
    totalPages,
    total: all.length,
    cards: slice.map(toCardData),
  });
}
