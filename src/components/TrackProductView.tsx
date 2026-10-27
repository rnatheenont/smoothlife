"use client";

import { useEffect } from "react";
import { useRecentlyViewed } from "@/lib/recently-viewed-context";

// Mounted once by the product page: this product was opened.
//
// Two things listen for that. The shopper's own "ดูล่าสุด" row, which stays in
// their browser, and the shop's ranking, which counts opens per product so
// "แนะนำ" can lead with what people actually look at. It was named
// TrackRecentlyViewed when only the first existed.
export default function TrackProductView({ slug }: { slug: string }) {
  const { track, hydrated } = useRecentlyViewed();

  useEffect(() => {
    if (!hydrated) return;
    track(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, hydrated]);

  useEffect(() => {
    // Once per product per tab. Someone who reads the page, scrolls back up
    // and reloads, or opens a variant and comes back, is one person
    // interested in one product — counting each arrival would let a single
    // indecisive visit outrank a product ten people opened. sessionStorage
    // rather than localStorage so tomorrow's visit counts again.
    const key = `pv:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private browsing, or storage turned off. Count the view — a visitor
      // we cannot remember is still a visitor, and the per-address ceiling on
      // the route is what stops the pathological case.
    }
    // Deliberately not awaited and never surfaced: the page is already
    // rendered and this is the shop's bookkeeping, not the shopper's.
    fetch("/api/products/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return null;
}
