"use client";

import { useRecentlyViewed } from "@/lib/recently-viewed-context";
import { getProductBySlug } from "@/data/products";
import ProductCard from "./ProductCard";
import SectionHeading from "./SectionHeading";

export default function RecentlyViewedSection({ excludeSlug }: { excludeSlug?: string }) {
  const { slugs } = useRecentlyViewed();
  const viewed = slugs
    .filter((s) => s !== excludeSlug)
    .map((s) => getProductBySlug(s))
    // A sold-out product here is a dead end — it can't be added to the cart.
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.inStock))
    .slice(0, 4);

  if (viewed.length === 0) return null;

  return (
    <div className="mt-16">
      <SectionHeading title="สินค้าที่เพิ่งดู" subtitle="Recently viewed" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        {viewed.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </div>
  );
}
