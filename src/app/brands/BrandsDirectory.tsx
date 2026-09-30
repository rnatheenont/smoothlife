"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { categories } from "@/data/categories";
import type { Category } from "@/data/types";

export type BrandEntry = {
  slug: string;
  name: string;
  tagline: string;
  image?: string;
  productCount: number;
  categories: Category[];
  /** Total reviews across the brand's products — see the comment where it is built. */
  reviews: number;
};

// Alphabetical was the only order this page had, and sixty-four brands in
// alphabetical order means the first thing anyone sees is whatever begins
// with A. Popularity first, measured; the alphabet stays available for the
// times somebody knows the name and wants to walk to it.
type Sort = "popular" | "name";

// No "มาใหม่" option, and not for want of trying: the catalogue marks 53
// products as new and every one of them belongs to Smooth E, Smooth Life or
// Dentiste. Sorting the other 61 brands by a number that is zero for all of
// them hands back the popularity order with a different label on it.

const SORTS: { key: Sort; label: string }[] = [
  { key: "popular", label: "ยอดนิยม" },
  { key: "name", label: "ชื่อ A–Z" },
];

function chip(on: boolean) {
  return `shrink-0 rounded-full border px-3.5 py-2 text-[13px] transition-colors ${
    on
      ? "border-brand-emerald bg-brand-gradient-soft font-semibold text-brand-800"
      : "border-slate-200 bg-white text-slate-600 hover:border-brand-teal"
  }`;
}

function BrandCard({ b }: { b: BrandEntry }) {
  return (
    // The whole card is the target and looks like one. It used to be a logo
    // floating on the page with its name underneath and a hairline ring you
    // could not see, which read as a picture rather than a button.
    <Link
      href={`/brands/${b.slug}`}
      title={b.name}
      className="flex h-full flex-col rounded-xl2 border border-slate-200 bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-brand-teal hover:shadow-cardHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
    >
      {/* Square, because these logo files are square — a 5:3 or 4:3 box fits a
          1200x1200 logo to its height and leaves the width empty. */}
      <span className="relative block aspect-square w-full">
        {b.image ? (
          <Image
            src={b.image}
            alt={b.name}
            fill
            sizes="(max-width: 640px) 42vw, (max-width: 1024px) 28vw, 200px"
            className="object-contain p-1"
          />
        ) : (
          <span
            translate="no"
            className="grid h-full place-items-center px-2 text-center text-sm font-semibold text-slate-600"
          >
            {b.name}
          </span>
        )}
      </span>
      <span
        translate="no"
        className="mt-2.5 line-clamp-2 text-[13px] font-semibold leading-tight text-brand-ink"
      >
        {b.name}
      </span>
      <span className="mt-auto pt-1 text-[12px] text-slate-500">
        {b.productCount} สินค้า
      </span>
    </Link>
  );
}

export default function BrandsDirectory({
  house,
  brands,
}: {
  house: BrandEntry[];
  brands: BrandEntry[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [sort, setSort] = useState<Sort>("popular");

  const categoryCounts = useMemo(() => {
    const m = new Map<Category, number>();
    for (const b of [...house, ...brands])
      for (const c of b.categories) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
  }, [house, brands]);

  const q = query.trim().toLowerCase();
  // One test, used on both lists. The house brands sit in their own row above
  // the directory, and while the search only ran over the row below them,
  // typing "ฟัน" found nothing at all — the one brand whose tagline says
  // ยาสีฟัน is Dentiste, and Dentiste is a house brand.
  const matches = useMemo(() => {
    return (b: BrandEntry) => {
      if (category && !b.categories.includes(category)) return false;
      if (!q) return true;
      // Name is Latin and the tagline is Thai, and both are worth searching:
      // somebody after a toothpaste types "ฟัน", not "Dentiste".
      return (
        b.name.toLowerCase().includes(q) || b.tagline.toLowerCase().includes(q)
      );
    };
  }, [category, q]);

  const filtered = useMemo(() => {
    const list = brands.filter(matches);
    const byName = (a: BrandEntry, b: BrandEntry) =>
      a.name.localeCompare(b.name, "en");
    if (sort === "name") return [...list].sort(byName);
    return [...list].sort(
      (a, b) =>
        b.reviews - a.reviews ||
        b.productCount - a.productCount ||
        byName(a, b),
    );
  }, [brands, matches, sort]);

  const houseShown = house.filter(matches);
  const searching = Boolean(q) || category !== null;
  const total = filtered.length + houseShown.length;

  return (
    <div className="container-page py-8 md:py-12">
      <h1 className="text-2xl font-bold text-brand-ink md:text-3xl">
        แบรนด์ทั้งหมด
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        {house.length + brands.length} แบรนด์ที่วางขายจริงบนเว็บ
        คัดมาแล้วว่ามีของ ไม่ใช่รายชื่อเปล่า
      </p>

      {/* The one thing most people came to do, at the size that says so. It
          was a 230x36 field tucked beside the filters, smaller than the
          filters, with its own placeholder cut off. */}
      <div className="relative mt-5 max-w-xl">
        <Search
          size={20}
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="ค้นหาแบรนด์"
          placeholder="ค้นหาแบรนด์ เช่น CeraVe, ยาสีฟัน"
          className="h-13 w-full rounded-full border border-slate-200 bg-white ps-12 pe-12 text-[15px] text-brand-ink shadow-xs outline-none transition-colors placeholder:text-slate-400 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="ล้างคำค้นหา"
            className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition-colors hover:bg-surface-soft hover:text-brand-ink"
          >
            <X size={17} />
          </button>
        )}
      </div>

      {/* The house brands, once, above the directory. The three "Life So
          Smooth" badges that used to sit one per card said the same thing
          three times; the heading says it once. */}
      {houseShown.length > 0 && (
        <section className="mt-7">
          <h2 className="text-[13px] font-bold text-brand-800">
            แบรนด์ในเครือ Smooth Life
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 md:gap-4">
            {houseShown.map((b) => (
              <Link
                key={b.slug}
                href={`/brands/${b.slug}`}
                className="flex items-center gap-4 rounded-xl2 border border-brand-emerald/30 bg-brand-gradient-soft p-4 transition-all hover:-translate-y-0.5 hover:border-brand-emerald hover:shadow-cardHover"
              >
                <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-white/70 md:size-24">
                  {b.image && (
                    <Image
                      src={b.image}
                      alt={b.name}
                      fill
                      sizes="96px"
                      className="object-contain p-2"
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    translate="no"
                    className="block text-lg font-bold text-brand-ink"
                  >
                    {b.name}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-[13px] text-slate-600">
                    {b.tagline}
                  </span>
                  <span className="mt-1.5 block text-[12px] font-semibold text-brand-800">
                    {b.productCount} สินค้า
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 border-t border-slate-100 pt-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:px-0">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={chip(category === null)}
            >
              ทุกหมวด
            </button>
            {categories.map((c) => {
              const n = categoryCounts.get(c.slug) ?? 0;
              if (n === 0) return null;
              const on = category === c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setCategory(on ? null : c.slug)}
                  className={chip(on)}
                >
                  {c.nameTh}{" "}
                  <span className={on ? "text-brand-800/60" : "text-slate-400"}>
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Sorting, not filtering, so it looks different from the chips it
              sits beside — one control with the choices inside it. */}
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[13px] text-slate-500">เรียงตาม</span>
            <div className="flex rounded-full bg-surface-soft p-0.5">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  aria-pressed={sort === s.key}
                  className={`rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                    sort === s.key
                      ? "bg-white font-semibold text-brand-ink shadow-xs"
                      : "text-slate-500 hover:text-brand-ink"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {searching && (
        <p className="mt-5 text-sm text-slate-500">
          พบ <span className="font-semibold text-brand-ink">{total}</span>{" "}
          แบรนด์
          {q && <> สำหรับ “{query.trim()}”</>}
        </p>
      )}

      {total === 0 ? (
        <div className="mt-8 rounded-xl2 border border-dashed border-slate-200 py-14 text-center">
          <p className="text-sm text-slate-500">ไม่พบแบรนด์ที่ตรงกับที่ค้นหา</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory(null);
            }}
            className="mt-3 rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-brand-ink transition-colors hover:border-brand-teal"
          >
            ล้างตัวกรอง
          </button>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((b) => (
            <li key={b.slug}>
              <BrandCard b={b} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
