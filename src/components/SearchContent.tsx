"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, X } from "lucide-react";
import { concerns } from "@/data/categories";
import { articles } from "@/data/articles";
import ProductCard from "@/components/ProductCard";
import type { ProductCardData } from "@/data/card";

/** How many cards a search asks for at a time. */
const PAGE_SIZE = 24;

export default function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") || "";
  const [input, setInput] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialQ) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = input.trim();
      router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search", { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [input, router]);

  // What people search for is the only demand signal this shop owns (see
  // search_queries). Logged well after the URL is updated — the 300ms debounce
  // above is for keeping the address bar in step, and recording at that speed
  // would fill the table with the prefixes of every word anyone typed.
  // One row per query someone actually stopped on, and never the same one
  // twice in a row.
  const lastLogged = useRef("");
  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed.length < 2 || trimmed === lastLogged.current) return;
    const timer = setTimeout(() => {
      lastLogged.current = trimmed;
      const found = matchedProducts.length + matchedConcerns.length + matchedArticles.length;
      fetch("/api/search/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, results: found }),
        keepalive: true,
      }).catch(() => {
        // Nothing to tell the shopper: their search already worked.
      });
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const q = input.toLowerCase().trim();

  // Matching happens in /api/search/suggest — the same match on the same
  // fields the box in the header uses, so the two agree — rather than over a
  // catalogue the browser had to download to search.
  const [matchedProducts, setMatchedProducts] = useState<ProductCardData[]>([]);
  /** How many matched in all — not how many fitted in the first response. */
  const [totalProducts, setTotalProducts] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const latest = useRef(0);
  useEffect(() => {
    if (!q) {
      setMatchedProducts([]);
      setTotalProducts(0);
      return;
    }
    const id = ++latest.current;
    const timer = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}`)
        .then((r) => r.json())
        .then((data) => {
          if (id !== latest.current) return;
          setMatchedProducts(Array.isArray(data?.products) ? data.products : []);
          setTotalProducts(Number(data?.total) || 0);
        })
        .catch(() => {
          if (id !== latest.current) return;
          setMatchedProducts([]);
          setTotalProducts(0);
        });
    }, 180);
    return () => clearTimeout(timer);
  }, [q]);

  // The rest, a page at a time. Asking for everything at once would hand the
  // browser the catalogue again, which is the thing this endpoint exists to
  // avoid — but stopping at the first page, as it used to, meant a search for
  // a brand with thirty products reported twenty and offered no way on.
  async function loadMore() {
    const id = latest.current;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/search/suggest?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${matchedProducts.length}`
      );
      const data = await res.json();
      if (id !== latest.current) return;
      if (Array.isArray(data?.products)) {
        setMatchedProducts((prev) => [...prev, ...data.products]);
        setTotalProducts((t) => Number(data?.total) || t);
      }
    } catch {
      // Leave what is already on screen; the button can be pressed again.
    } finally {
      setLoadingMore(false);
    }
  }
  const matchedConcerns = q ? concerns.filter((c) => c.nameTh.includes(q) || c.name.toLowerCase().includes(q)) : [];
  const matchedArticles = q ? articles.filter((a) => a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q)) : [];

  const noResults = q && matchedProducts.length === 0 && matchedConcerns.length === 0 && matchedArticles.length === 0;

  // The shelf shown when there is nothing to show yet — same cascade as
  // before (bestsellers, then sale, then anything in stock), worked out on
  // the server now. See /api/products/lite?recommended=1.
  const [recommendedProducts, setRecommendedProducts] = useState<ProductCardData[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/products/lite?recommended=1&limit=8")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.cards)) setRecommendedProducts(data.cards);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container-page py-6 md:py-10">
      <div className="relative mb-6 md:max-w-xl">
        <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          placeholder="ค้นหาสินค้า, แบรนด์ หรือปัญหาผิว…"
          className="w-full rounded-full border border-slate-200 bg-surface-soft py-3 pl-11 pr-11 text-sm outline-hidden focus:border-brand-teal transition-colors"
        />
        {input && (
          <button
            onClick={() => {
              setInput("");
              inputRef.current?.focus();
            }}
            aria-label="ล้างคำค้นหา"
            className="absolute right-3 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full bg-slate-200 text-slate-500"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {!q && (
        <div>
          <p className="text-sm text-slate-500 mb-3">ปัญหาผิวยอดฮิต</p>
          <div className="flex flex-wrap gap-2">
            {concerns.slice(0, 6).map((c) => (
              <Link
                key={c.slug}
                href={`/concern/${c.slug}`}
                className="rounded-full bg-surface-soft text-brand-ink text-sm font-medium px-4 py-2 hover:bg-surface-muted transition-colors"
              >
                {c.nameTh}
              </Link>
            ))}
          </div>

          <div className="mt-8">
            <h2 className="font-bold text-brand-ink mb-3">สินค้าแนะนำ</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-5">
              {recommendedProducts.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </div>
        </div>
      )}

      {q && (
        <h1 className="text-lg font-bold text-brand-ink mb-1">ผลการค้นหาสำหรับ &quot;{input.trim()}&quot;</h1>
      )}

      {noResults && (
        <>
          <div className="text-center py-10 text-slate-500">
            <p>ไม่พบผลลัพธ์สำหรับ &quot;{input.trim()}&quot;</p>
            <Link href="/shop" className="text-brand-800 font-semibold text-sm mt-2 inline-block">ดูสินค้าทั้งหมด</Link>
          </div>

          <div>
            <h2 className="font-bold text-brand-ink mb-3">สินค้าแนะนำ</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-5">
              {recommendedProducts.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </div>
        </>
      )}

      {matchedConcerns.length > 0 && (
        <div className="mt-8">
          <h2 className="font-bold text-brand-ink mb-3">ปัญหาผิวที่เกี่ยวข้อง</h2>
          <div className="flex flex-wrap gap-2">
            {matchedConcerns.map((c) => (
              <Link key={c.slug} href={`/concern/${c.slug}`} className="rounded-full bg-brand-gradient-soft text-brand-800 text-sm font-medium px-4 py-2">
                {c.nameTh}
              </Link>
            ))}
          </div>
        </div>
      )}

      {matchedProducts.length > 0 && (
        <div className="mt-8">
          <h2 className="font-bold text-brand-ink mb-3">
            สินค้า ({totalProducts || matchedProducts.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-5">
            {matchedProducts.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
          {matchedProducts.length < totalProducts && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="min-h-11 rounded-full border border-surface-line px-6 text-sm font-semibold text-brand-ink transition-colors hover:bg-surface-soft disabled:opacity-50"
              >
                {loadingMore ? "กำลังโหลด…" : "ดูสินค้าเพิ่ม"}
              </button>
              <span className="text-[12px] text-slate-500">
                แสดง {matchedProducts.length} จาก {totalProducts} รายการ
              </span>
            </div>
          )}
        </div>
      )}

      {matchedArticles.length > 0 && (
        <div className="mt-8">
          <h2 className="font-bold text-brand-ink mb-3">บทความและคู่มือ</h2>
          <div className="flex flex-col gap-2">
            {matchedArticles.map((a) => (
              <Link key={a.slug} href={`/knowledge/article/${a.slug}`} className="text-sm font-medium text-brand-800 hover:underline">
                {a.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
