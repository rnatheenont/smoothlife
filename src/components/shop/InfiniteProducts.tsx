"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import type { ProductCardData } from "@/data/card";
import type { ShopSearchParams } from "@/lib/filter-products";

// The rest of the shop, arriving as you reach it.
//
// Page one is still rendered by the server — it is what a crawler reads, what
// a share link opens on, and what paints before any JavaScript runs. This
// picks up from page two, appending into the same grid, so nothing that was
// already working had to be given up to stop making people hunt for a page
// number at the bottom of a long scroll.
//
// There is a button as well as a sentinel, and it is not decoration: it is
// what works when IntersectionObserver does not fire — a tab restored into
// the background, a browser that never scrolls because the window is taller
// than the list. "Nothing happened and there is nothing to press" is the
// failure mode infinite scroll is famous for, and one button removes it.

export default function InfiniteProducts({
  params,
  page,
  totalPages,
}: {
  /** The filters the server rendered page one with. */
  params: ShopSearchParams;
  /** The page already on screen. */
  page: number;
  totalPages: number;
}) {
  const [loaded, setLoaded] = useState<ProductCardData[]>([]);
  const [next, setNext] = useState(page + 1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  // Read inside the callback rather than listed as a dependency: the observer
  // is re-created whenever its callback identity changes, and a callback that
  // changed on every fetch would disconnect and reconnect mid-scroll.
  const busyRef = useRef(false);

  const done = next > totalPages;

  const loadMore = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v && k !== "page") qs.set(k, String(v));
      }
      qs.set("page", String(next));
      const res = await fetch(`/api/products/page?${qs}`, { cache: "no-store" });
      const json = await res.json();
      if (!json?.ok) throw new Error("bad response");
      setLoaded((cur) => [...cur, ...(json.cards as ProductCardData[])]);
      setNext((n) => n + 1);
    } catch {
      // Said out loud, with the button still there to press again. A grid
      // that simply stops is indistinguishable from a grid that ended.
      setFailed(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [params, next]);

  useEffect(() => {
    if (done || failed) return;
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // 600px of warning, so the next two rows are usually already there by
    // the time the last one is read.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, done, failed]);

  return (
    <>
      {loaded.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:mt-5 md:grid-cols-3 md:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
          {loaded.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}

      <div ref={sentinel} className="mt-8 flex flex-col items-center gap-3">
        {busy && (
          <p className="flex items-center gap-2 text-sm text-slate-400" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            กำลังโหลดสินค้าเพิ่ม…
          </p>
        )}

        {failed && !busy && (
          <p role="alert" className="text-sm text-slate-500">
            โหลดสินค้าเพิ่มไม่สำเร็จ
          </p>
        )}

        {!done && !busy && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-teal hover:text-brand-800"
          >
            {failed ? "ลองอีกครั้ง" : "ดูสินค้าเพิ่ม"}
          </button>
        )}

        {done && loaded.length > 0 && (
          <p className="text-sm text-slate-400">ดูครบทุกรายการแล้ว</p>
        )}
      </div>
    </>
  );
}
