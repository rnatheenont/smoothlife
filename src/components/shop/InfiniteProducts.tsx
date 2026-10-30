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
 *  This started at three, as a brake on iOS Safari killing the tab — "A
 *  problem repeatedly occurred", a black screen, and everything scrolled
 *  past gone. The brake was not the fix and it did not work: the cause was
 *  the card images, which were being served at 560px for a 163px slot and
 *  came to 147 MB of decoded image on a phone. Square crops and a real
 *  srcset took the same hundred cards to 15 MB, so the ceiling went back up
 *  to eight.
 *
 *  Back down to four, because a tab died again on 29 Oct — Chrome on iOS
 *  this time. Eight pages plus the first is 216 products: measured on the
 *  live grid that is 42,600px of page, about fifty phone screens, 247 images
 *  and some 32 MB of decoded image at the pixel ratio of a real phone. The
 *  images are no longer the scandal they were, but that is still a lot to
 *  ask a browser to hold because somebody kept a thumb on the screen.
 *
 *  Four is 120 products, around 23,000px — further than anybody reads in one
 *  sitting, and the button is right there for whoever does. Paired with
 *  content-visibility on the grid (see globals.css), which is what stops the
 *  cards already loaded from costing anything to keep. */
const AUTO_PAGES = 4;

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
      {/* grid-virtualized: the cards past the viewport cost nothing to
          paint. See globals.css — it is what keeps a few hundred of them in
          one document from killing the tab on a phone. */}
      <div className="grid-virtualized grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
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
