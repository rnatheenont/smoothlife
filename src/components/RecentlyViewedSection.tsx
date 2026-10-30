"use client";

import { useRecentlyViewed } from "@/lib/recently-viewed-context";
import { cardFromLite } from "@/data/cart-product";
import { inSlugOrder, useLiteProducts } from "@/lib/use-lite-products";
import ProductCard from "./ProductCard";
import SectionHeading from "./SectionHeading";

const SHOWN = 5;

export default function RecentlyViewedSection({ excludeSlug }: { excludeSlug?: string }) {
  const { slugs } = useRecentlyViewed();
  // Which products these are is only known in the browser — the list comes
  // from this device. Asking for the five of them is what this section costs
  // now; it used to cost the whole catalogue (see use-lite-products).
  const wanted = slugs.filter((s) => s !== excludeSlug).slice(0, SHOWN);
  const { products } = useLiteProducts(wanted);

  const viewed = inSlugOrder(products, wanted)
    // A sold-out product here is a dead end — it can't be added to the cart.
    .filter((p) => p.variants.some((v) => v.inStock))
    .slice(0, SHOWN);

  if (viewed.length === 0) return null;

  return (
    <div className="mt-16">
      <SectionHeading title="สินค้าที่เพิ่งดู" subtitle="Recently viewed" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-5">
        {viewed.map((p) => (
          <ProductCard key={p.slug} product={cardFromLite(p)} />
        ))}
      </div>
    </div>
  );
}
