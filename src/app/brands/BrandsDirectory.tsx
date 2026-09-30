"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Input, Label, TextField } from "@heroui/react";
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
  letter: string;
};

// Every letter gets a key on the rail, including the ones nobody sells —
// a row that changed length with the catalogue would move under the cursor,
// and a greyed-out K says "no K brands" where a missing K says nothing.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function BrandTile({ b, letter }: { b: BrandEntry; letter?: string }) {
  return (
    <Link href={`/brands/${b.slug}`} className="group block" title={b.name}>
      {/* Square, because these logo files are square — the same thing the
          mega menu's tiles had to learn. A 5:3 or 4:3 box fits a 1200x1200
          logo to its height and leaves the width empty. */}
      <div className="relative grid aspect-square place-items-center overflow-hidden rounded-xl2 bg-white ring-1 ring-slate-100 transition group-hover:ring-brand-teal group-hover:shadow-cardHover">
        {b.image ? (
          <Image
            src={b.image}
            alt={b.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
            className="object-contain p-3"
          />
        ) : (
          <span
            translate="no"
            className="px-3 text-center text-sm font-semibold text-slate-600"
          >
            {b.name}
          </span>
        )}
        {/* Where the alphabet turns over, marked on the tile itself. The
            letters were their own sections at first, and with an average of
            three brands each that left most rows two-thirds empty — the page
            ran to 6,600px to say what fits in half of it. */}
        {letter && (
          <span
            aria-hidden
            className="absolute left-2 top-1.5 text-[12px] font-semibold text-slate-300 transition-colors group-hover:text-brand-teal"
          >
            {letter}
          </span>
        )}
      </div>
      <p
        translate="no"
        className="mt-2 truncate text-[14px] font-semibold text-brand-ink"
      >
        {b.name}
      </p>
      <p className="text-[12px] text-slate-500">{b.productCount} สินค้า</p>
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

  // Counts come off the same list the grid draws, so a filter can never offer
  // a category that turns out to be empty once it is applied.
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

  const filtered = useMemo(() => brands.filter(matches), [brands, matches]);

  const searching = Boolean(q) || category !== null;
  // One grid, not one per letter: the slug of the first brand under each
  // letter, so the A-Z rail has something to jump to without the alphabet
  // having to break the grid into rows it cannot fill.
  const firstOfLetter = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of filtered) if (!m.has(b.letter)) m.set(b.letter, b.slug);
    return m;
  }, [filtered]);
  const letterOfSlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const [letter, slug] of firstOfLetter) m.set(slug, letter);
    return m;
  }, [firstOfLetter]);

  const houseShown = house.filter(matches);

  return (
    <div className="container-page py-8 md:py-12">
      <h1 className="text-2xl font-bold text-brand-ink md:text-3xl">
        แบรนด์ทั้งหมด
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        {house.length + brands.length} แบรนด์ที่วางขายจริงบนเว็บ
        คัดมาแล้วว่ามีของ ไม่ใช่รายชื่อเปล่า
      </p>

      {/* The house brands, once, above the directory — this is the shop's own
          answer to "whose shop is this". The three "Life So Smooth" badges
          that used to sit one per card said the same thing three times; the
          heading says it once and the cards get their room back. */}
      {houseShown.length > 0 && (
        <section className="mt-6 md:mt-8">
          <h2 className="text-[13px] font-bold text-brand-800">
            แบรนด์ในเครือ Smooth Life
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 md:gap-4">
            {houseShown.map((b) => (
              <Link
                key={b.slug}
                href={`/brands/${b.slug}`}
                className="flex items-center gap-4 rounded-xl2 border border-brand-emerald/25 bg-brand-gradient-soft p-4 transition hover:border-brand-emerald hover:shadow-cardHover"
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

      {/* Find first, browse second. Sixty-six brands is past the point where
          scrolling is a search, which is why every brand directory worth
          copying — Selfridges, Urban Outfitters — opens with a field and an
          alphabet rather than with the brands themselves. */}
      <div className="mt-8 border-t border-slate-100 pt-6 md:mt-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TextField className="w-full md:max-w-xs" aria-label="ค้นหาแบรนด์">
            <Label className="sr-only">ค้นหาแบรนด์</Label>
            <div className="relative">
              <Search
                size={16}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาแบรนด์ เช่น CeraVe, ยาสีฟัน"
                className="ps-9 pe-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition-colors hover:bg-surface-soft hover:text-brand-ink"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </TextField>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
                category === null
                  ? "border-brand-emerald bg-brand-gradient-soft font-semibold text-brand-800"
                  : "border-slate-200 text-slate-600 hover:border-brand-teal"
              }`}
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
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
                    on
                      ? "border-brand-emerald bg-brand-gradient-soft font-semibold text-brand-800"
                      : "border-slate-200 text-slate-600 hover:border-brand-teal"
                  }`}
                >
                  {c.nameTh} <span className="text-slate-400">{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The alphabet is a map of the page, so it is only shown when the
            page is still the whole catalogue. Once a search has cut it down,
            jumping to R is jumping to something that may not be there. */}
        {!searching && (
          <div className="mt-4 flex flex-wrap gap-1">
            {ALPHABET.map((l) => {
              const has = firstOfLetter.has(l);
              return has ? (
                <a
                  key={l}
                  href={`#letter-${l}`}
                  className="grid size-8 place-items-center rounded-lg text-[13px] font-semibold text-slate-600 transition-colors hover:bg-surface-soft hover:text-brand-800"
                >
                  {l}
                </a>
              ) : (
                <span
                  key={l}
                  aria-hidden
                  className="grid size-8 place-items-center text-[13px] text-slate-300"
                >
                  {l}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {searching && (
        <p className="mt-6 text-sm text-slate-500">
          พบ{" "}
          <span className="font-semibold text-brand-ink">
            {filtered.length + houseShown.length}
          </span>{" "}
          แบรนด์
          {q && <> สำหรับ “{query.trim()}”</>}
        </p>
      )}

      {filtered.length + houseShown.length === 0 ? (
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
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((b) => {
            const letter = letterOfSlug.get(b.slug);
            return (
              <li
                key={b.slug}
                id={letter ? `letter-${letter}` : undefined}
                // Measured, not guessed: the header stays 152px tall on a desktop while
                // the page scrolls under it, so a jump to "M" landed the M tile
                // 21px *behind* it. On a phone the header all but scrolls away, so
                // it needs far less.
                className="scroll-mt-24 md:scroll-mt-44"
              >
                <BrandTile b={b} letter={searching ? undefined : letter} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
