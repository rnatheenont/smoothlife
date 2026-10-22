import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/staff-sale-admin";
import { collections, getCollectionByHandle } from "@/data/collections";
import { getProductDetail, productDetails } from "@/data/product-details";

// Admin: what the product picker reads.
//
// Served from the server's own catalogue rather than from Shopify on every
// keystroke: product-details holds every variant with its price, its SKU and
// Shopify's real stock count, and it is already in memory. It is also the
// 3 MB catalogue that must never reach a browser — hence a route handler
// rather than an import in the page.

const MAX = 400;

type PickerVariant = {
  variant_id: string;
  size: string;
  sku: string | null;
  price: number;
  compare_at: number | null;
  in_stock: boolean;
  quantity: number | null;
};

type PickerProduct = {
  slug: string;
  name: string;
  brand: string;
  image: string | null;
  variants: PickerVariant[];
};

function toPicker(slug: string): PickerProduct | null {
  const p = getProductDetail(slug);
  if (!p) return null;
  return {
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    image: p.image ?? null,
    variants: p.variants.map((v) => ({
      variant_id: v.variantId,
      size: v.size,
      sku: v.sku ?? null,
      price: v.price,
      compare_at: v.compareAtPrice ?? null,
      in_stock: v.inStock,
      quantity: v.quantity ?? null,
    })),
  };
}

export async function GET(req: NextRequest) {
  const stop = guard(req);
  if (stop) return stop;

  const sp = req.nextUrl.searchParams;
  const handle = sp.get("collection");
  const q = (sp.get("q") ?? "").trim().toLowerCase();

  // No argument: the list of collections to choose from. Returned with their
  // sizes so the picker can say "clearance-sale · 42 รายการ" rather than
  // making somebody open each one to find out.
  if (!handle && !q) {
    return NextResponse.json({
      ok: true,
      collections: collections.map((c) => ({
        handle: c.handle,
        title: c.title,
        count: c.productSlugs.length,
      })),
      // Empty in a local checkout: collections.generated.ts is written at
      // build time from Shopify, so searching by name is the way in here.
      catalogueSize: productDetails.length,
    });
  }

  if (handle) {
    const collection = getCollectionByHandle(handle);
    if (!collection) {
      return NextResponse.json({ ok: false, error: "ไม่พบ collection นี้" }, { status: 404 });
    }
    const products = collection.productSlugs
      .slice(0, MAX)
      .map(toPicker)
      .filter((p): p is PickerProduct => p !== null);
    return NextResponse.json({
      ok: true,
      collection: { handle: collection.handle, title: collection.title },
      products,
      truncated: collection.productSlugs.length > MAX,
    });
  }

  // Search is over the name, the brand and the SKU, because those are the
  // three things the people filling in this form actually have in front of
  // them — a slug is not one of them.
  const matches: PickerProduct[] = [];
  for (const p of productDetails) {
    if (matches.length >= MAX) break;
    const hit =
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.slug.includes(q) ||
      p.variants.some((v) => v.sku?.toLowerCase().includes(q));
    if (hit) {
      const picked = toPicker(p.slug);
      if (picked) matches.push(picked);
    }
  }

  return NextResponse.json({ ok: true, products: matches, truncated: matches.length >= MAX });
}
