"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import type { ProductCardData } from "@/data/card";
import type { ShopSearchParams } from "@/lib/filter-products";

// The shop grid, with the rest of it arriving as you reach the bottom.
//
// It owns the whole grid, page one included, and that is the fix for a gap
// that was showing mid-list: page one was a server-rendered grid and the
// fetched pages were a second grid underneath it, so 24 products across five
// columns left four in the last row and a hole beside them before the next
// grid started. One grid has no seam to leave a hole in.
//
// Being a client component costs nothing here: the App Router still renders
// it to HTML on the server, so the first page is in the source a crawler
// reads and on screen before any JavaScript runs — the same two things the
// server-rendered grid was there for.

/** Pages fetched without being asked before the button takes over.
 *
 *  A phone that scrolls steadily for a minute would otherwise hold a
 *  thousand product cards and their images in one document, and iOS Safari
 *  answers that by killing the tab — "A problem repeatedly occurred", a
 *  black screen, and everything the shopper had scrolled past gone. Three
 *  pages is 96 products, which is more than anybody reads in one go, and
 *  after that carrying on is a decision rather than a side effect. */
const AUTO_PAGES = 3;

export default function InfiniteProducts({
  initial,
  params,
  page,
  totalPages,
}: {
  /** Page one, rendered on the server and handed over as the first rows. */
  initial: ProductCardData[];
  params: ShopSearchParams;
  page: number;
  totalPages: number;
}) {
  const [extra, setExtra] = useState<ProductCardData[]>([]);
  const [next, setNext] = useState(page + 1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [autoUsed, setAutoUsed] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  // Read inside the callback rather than listed as a dependency: the
  // observer is rebuilt whenever its callback identity changes, and one that
  // changed on every fetch would disconnect and reconnect mid-scroll.
  const busyRef = useRef(false);

  const done = next > totalPages;
  const autoOff = autoUsed >= AUTO_PAGES;

  const loadMore = useCallback(
    async (auto: boolean) => {
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
        setExtra((cur) => [...cur, ...(json.cards as ProductCardData[])]);
        setNext((n) => n + 1);
        if (auto) setAutoUsed((n) => n + 1);
      } catch {
        // Said out loud, with the button still there to press again. A grid
        // that simply stops is indistinguishable from a grid that ended.
        setFailed(true);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [params, next],
  );

  useEffect(() => {
    if (done || failed || autoOff) return;
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // 600px of warning, so the next rows are usually already there by the
    // time the last one is read.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore(true);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, done, failed, autoOff]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
        {[...initial, ...extra].map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>

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
            onClick={() => void loadMore(false)}
            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-teal hover:text-brand-800"
          >
            {failed ? "ลองอีกครั้ง" : "ดูสินค้าเพิ่ม"}
          </button>
        )}

        {done && extra.length > 0 && <p className="text-sm text-slate-400">ดูครบทุกรายการแล้ว</p>}
      </div>
    </>
  );
}
