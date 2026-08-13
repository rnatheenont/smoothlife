"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type RecentlyViewedValue = {
  slugs: string[];
  track: (slug: string) => void;
  hydrated: boolean;
};

const RecentlyViewedContext = createContext<RecentlyViewedValue | null>(null);
const KEY = "sl_recently_viewed";
const MAX = 12;

export function RecentlyViewedProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setSlugs(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {
      setSlugs([]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(slugs));
  }, [slugs, hydrated]);

  function track(slug: string) {
    setSlugs((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, MAX));
  }

  return (
    <RecentlyViewedContext.Provider value={{ slugs, track, hydrated }}>{children}</RecentlyViewedContext.Provider>
  );
}

export function useRecentlyViewed() {
  const ctx = useContext(RecentlyViewedContext);
  if (!ctx) return { slugs: [], track: () => {}, hydrated: false } as RecentlyViewedValue;
  return ctx;
}
