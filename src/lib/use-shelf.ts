"use client";

import { useEffect, useState } from "react";
import type { ProductCardData } from "@/data/card";

// A shelf of products the page did not send.
//
// The home page's carousels each have several shelves and show one at a
// time. Sending them all as props put about 150 product cards into the HTML
// of a page everybody loads; sending the first one and asking for the others
// as the carousel is turned puts ten there and costs one cached request per
// shelf somebody actually looks at.

const cache = new Map<string, ProductCardData[]>();

/**
 * @param key   `concern=acne` or `brand=smooth-e` — the query this shelf is.
 * @param given The shelf the server already sent, if it sent this one.
 */
export function useShelf(key: string | null, given?: ProductCardData[]): ProductCardData[] {
  const [fetched, setFetched] = useState<ProductCardData[]>(() => (key ? (cache.get(key) ?? []) : []));

  useEffect(() => {
    if (!key || given?.length) return;
    const cached = cache.get(key);
    if (cached) {
      setFetched(cached);
      return;
    }
    let cancelled = false;
    fetch(`/api/products/lite?${key}&limit=10`)
      .then((r) => r.json())
      .then((data) => {
        const cards: ProductCardData[] = Array.isArray(data?.cards) ? data.cards : [];
        cache.set(key, cards);
        if (!cancelled) setFetched(cards);
      })
      // An empty shelf, which is what the carousel already draws for a
      // concern nothing is tagged with.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, given]);

  return given?.length ? given : fetched;
}
