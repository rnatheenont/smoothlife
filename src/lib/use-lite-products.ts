"use client";

import { useEffect, useState } from "react";
import type { LiteProduct } from "@/data/cart-product";

// A few products, by slug, for the handful of places that only learn which
// ones they want once they are in the browser — what you looked at last, what
// is in your cart, what a chat answer named.
//
// Every one of them used to call getProductBySlug(), which is an import of
// the whole catalogue: ~650 KB in every visitor's browser so that four cards
// could be drawn. The route behind this is edge-cached for a minute, and the
// answer for one set of slugs is shared by every component asking for it.

const cache = new Map<string, LiteProduct[]>();

export function useLiteProducts(slugs: string[]): { products: LiteProduct[]; loading: boolean } {
  // Sorted and joined so two components wanting the same products in a
  // different order share one request and one cache entry.
  const key = [...new Set(slugs)].sort().join(",");
  const [products, setProducts] = useState<LiteProduct[]>(() => cache.get(key) ?? []);
  const [loading, setLoading] = useState(() => Boolean(key) && !cache.has(key));

  useEffect(() => {
    if (!key) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const cached = cache.get(key);
    if (cached) {
      setProducts(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/products/lite?slugs=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((data) => {
        const rows: LiteProduct[] = Array.isArray(data?.products) ? data.products : [];
        cache.set(key, rows);
        if (!cancelled) setProducts(rows);
      })
      // Nothing to show rather than something wrong: every caller draws a
      // shelf of extras, and an empty shelf is a page without a shelf.
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { products, loading };
}

/** The same products, in the order the caller asked for them. */
export function inSlugOrder(products: LiteProduct[], slugs: string[]): LiteProduct[] {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  return slugs.map((s) => bySlug.get(s)).filter((p): p is LiteProduct => Boolean(p));
}
