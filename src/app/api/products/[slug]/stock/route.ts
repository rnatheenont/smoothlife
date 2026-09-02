import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug } from "@/data/products";
import { getVariantAvailability } from "@/lib/shopify-admin";

// Live stock for a product's variants — the static catalogue
// (products.generated.ts) is only ever as fresh as the last rebuild
// (near-instant once the catalogue webhooks are registered, but never
// truly real-time). The product detail page is the one place a customer
// actually decides to buy, so it fetches this on mount to override the
// static inStock/quantity with the real-time truth from
// getVariantAvailability() — the same live check already used at
// checkout time for stock reservation.
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const entries = await Promise.all(
    product.variants.map(async (v) => {
      const live = await getVariantAvailability(v.variantId);
      return [v.variantId, live] as const;
    })
  );

  const stock: Record<string, { inStock: boolean; quantity: number | null }> = {};
  for (const [variantId, live] of entries) {
    // null means "couldn't verify" (unconfigured, API error, etc.) —
    // omit it entirely so the client falls back to the static value
    // rather than treating a lookup failure as real data.
    if (live) stock[variantId] = { inStock: live.availableForSale, quantity: live.inventoryQuantity };
  }

  return NextResponse.json({ ok: true, stock });
}
