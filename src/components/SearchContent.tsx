"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, X } from "lucide-react";
import { products } from "@/data/products";
import { concerns } from "@/data/categories";
import { articles } from "@/data/articles";
import ProductCard from "@/components/ProductCard";

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

  const q = input.toLowerCase().trim();

  const matchedProducts = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
    : [];
  const matchedConcerns = q ? concerns.filter((c) => c.nameTh.includes(q) || c.name.toLowerCase().includes(q)) : [];
  const matchedArticles = q ? articles.filter((a) => a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q)) : [];

  const noResults = q && matchedProducts.length === 0 && matchedConcerns.length === 0 && matchedArticles.length === 0;

  const recommendedProducts = products
    .filter((p) => p.inStock && p.badges?.includes("Bestseller"))
    .concat(products.filter((p) => p.inStock && p.badges?.includes("Sale")))
    .concat(products.filter((p) => p.inStock))
    .filter((p, i, arr) => arr.findIndex((x) => x.slug === p.slug) === i)
    .slice(0, 8);

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
          placeholder="ค้นหาสินค้า, แบรนด์ หรือปัญหาผิว..."
          className="w-full rounded-full border border-slate-200 bg-surface-soft py-3 pl-11 pr-11 text-sm outline-none focus:border-brand-teal transition-colors"
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
              <button
                key={c.slug}
                onClick={() => setInput(c.nameTh)}
                className="rounded-full bg-surface-soft text-brand-ink text-sm font-medium px-4 py-2 hover:bg-surface-muted transition-colors"
              >
                {c.nameTh}
              </button>
            ))}
          </div>

          <div className="mt-8">
            <h2 className="font-bold text-brand-ink mb-3">สินค้าแนะนำ</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
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
          <div className="text-center py-10 text-slate-400">
            <p>ไม่พบผลลัพธ์สำหรับ &quot;{input.trim()}&quot;</p>
            <Link href="/shop" className="text-brand-emerald font-semibold text-sm mt-2 inline-block">ดูสินค้าทั้งหมด</Link>
          </div>

          <div>
            <h2 className="font-bold text-brand-ink mb-3">สินค้าแนะนำ</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
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
              <Link key={c.slug} href={`/concern/${c.slug}`} className="rounded-full bg-brand-gradient-soft text-brand-emerald text-sm font-medium px-4 py-2">
                {c.nameTh}
              </Link>
            ))}
          </div>
        </div>
      )}

      {matchedProducts.length > 0 && (
        <div className="mt-8">
          <h2 className="font-bold text-brand-ink mb-3">สินค้า ({matchedProducts.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {matchedProducts.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      )}

      {matchedArticles.length > 0 && (
        <div className="mt-8">
          <h2 className="font-bold text-brand-ink mb-3">บทความและคู่มือ</h2>
          <div className="flex flex-col gap-2">
            {matchedArticles.map((a) => (
              <Link key={a.slug} href={`/knowledge/article/${a.slug}`} className="text-sm font-medium text-brand-emerald hover:underline">
                {a.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
