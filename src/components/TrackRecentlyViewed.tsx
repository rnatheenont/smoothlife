"use client";

import { useEffect } from "react";
import { useRecentlyViewed } from "@/lib/recently-viewed-context";

export default function TrackRecentlyViewed({ slug }: { slug: string }) {
  const { track, hydrated } = useRecentlyViewed();

  useEffect(() => {
    if (!hydrated) return;
    track(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, hydrated]);

  return null;
}
