"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { products } from "@/data/products";
import { concerns } from "@/data/categories";
import { articles } from "@/data/articles";
import ProductCard from "@/components/ProductCard";

export default function SearchContent() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") || "").toLowerCase().trim();

  const matchedProducts = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
    : [];
  const matchedConcerns = q ? concerns.filter((c) => c.nameTh.includes(q) || c.name.toLowerCase().includes(q)) : [];
  const matchedArticles = q ? articles.filter((a) => a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q)) : [];

  const noResults = q && matchedProducts.length === 0 && matchedConcerns.length === 0 && matchedArticles.length === 0;

  return (
    <div className="container-page py-8 md:py-10">
      <div className="flex items-center gap-2 mb-2">
        <SearchIcon size={20} className="text-brand-emerald" />
        <h1 className="text-2xl font-bold text-brand-ink">
          {q ? `ผลการค้นหาสำหรับ "${q}"` : "ค้นหาสินค้า, แบรนด์ หรือปัญหาผิว"}
        </h1>
      </div>

      {!q && <p className="text-sm text-slate-500 mt-4">พิมพ์คำค้นหาที่แถบด้านบนเพื่อเริ่มค้นหา</p>}

      {noResults && (
        <div className="text-center py-16 text-slate-400">
          <p>ไม่พบผลลัพธ์สำหรับ &quot;{q}&quot;</p>
          <Link href="/shop" className="text-brand-emerald font-semibold text-sm mt-2 inline-block">ดูสินค้าทั้งหมด</Link>
        </div>
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
