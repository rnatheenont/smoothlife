"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Brand } from "@/data/types";
import { brandProducts } from "@/data/brands";
import ProductCard from "@/components/ProductCard";

// Nine brands in circles, and underneath them what the one you picked sells.
//
// This replaces the scrolling logo wall, which existed because the catalogue
// carries dozens of vendors and a fixed grid either hid most of them or grew
// enormous. The design picks nine instead — so the section heading's "ดูทั้งหมด"
// link is what carries the other fifty-odd now, and it has to stay.
//
// The circles are tabs rather than links: tapping one used to leave the home
// page to find out what the brand sells, and the answer fits on the page it
// was already on. The brand's own hub is still one tap away, from inside the
// panel, for anyone who wants the full range.

const FEATURED = [
  "smooth-e",
  "dentiste",
  "janeke",
  "eucerin",
  "cerave",
  "blackmores",
  "mega",
  "swisse",
  "vichy",
];

/** Six in the rail, four and a half of them in view: the half card says
 *  there is more, and now there genuinely is. */
const SHOWN = 6;

export default function BrandCircleRow({ brands }: { brands: Brand[] }) {
  // Named order first, then whatever is left over if one of them is ever
  // dropped from brands.ts — nine circles with a hole in the row is worse
  // than nine circles with a substitute in it.
  const row = useMemo(() => {
    const picked = FEATURED.map((slug) => brands.find((b) => b.slug === slug)).filter(
      (b): b is Brand => Boolean(b)
    );
    const fill = brands.filter((b) => !picked.includes(b)).slice(0, FEATURED.length - picked.length);
    return [...picked, ...fill];
  }, [brands]);

  const [active, setActive] = useState(0);
  const brand = row[active];

  // In stock and with a picture: a shelf of grey placeholders under a brand's
  // logo says less about it than showing nothing would.
  const shelf = useMemo(
    () => (brand ? brandProducts(brand).filter((p) => p.inStock && p.image).slice(0, SHOWN) : []),
    [brand]
  );

  if (!brand) return null;

  return (
    <div>
      <ul
        role="tablist"
        aria-label="แบรนด์ที่คุณไว้วางใจ"
        className="mx-auto flex max-w-[1512px] gap-5 overflow-x-auto px-4 pt-2 scrollbar-none md:px-6 lg:justify-center lg:gap-[clamp(1rem,2.4vw,2.1rem)] lg:overflow-visible"
      >
        {row.map((b, i) => {
          const on = i === active;
          return (
            <li key={b.slug} className="shrink-0">
              <button
                type="button"
                role="tab"
                id={`brand-tab-${b.slug}`}
                aria-selected={on}
                aria-controls="brand-shelf"
                onClick={() => setActive(i)}
                className="group flex w-[96px] flex-col items-center gap-3 lg:w-[116px]"
              >
                <span
                  className={`grid h-[88px] w-[88px] place-items-center overflow-hidden rounded-full bg-white transition-all duration-300 group-active:scale-95 lg:h-[116px] lg:w-[116px] ${
                    on
                      ? "border-2 border-brand-teal shadow-card"
                      : "border border-slate-200/80 group-hover:border-brand-200 group-hover:shadow-card"
                  }`}
                >
                  {b.image ? (
                    // The logos are square collection images with their own
                    // padding baked in, so the circle shows about 70% of the
                    // box rather than the whole thing shrunk into the middle.
                    <span className="relative block h-[70%] w-[70%]">
                      <Image src={b.image} alt="" fill sizes="116px" className="object-contain" />
                    </span>
                  ) : (
                    <span translate="no" className="px-2 text-center text-xs font-semibold text-slate-600">
                      {b.name}
                    </span>
                  )}
                </span>
                <span
                  translate="no"
                  className={`line-clamp-1 text-center text-[13px] transition-colors lg:text-[15px] ${
                    on ? "font-bold text-brand-800" : "font-medium text-brand-ink group-hover:text-brand-800"
                  }`}
                >
                  {b.name}
                </span>
              </button>
              {/* The notch belongs to the circle, not to the panel: kept here
                  it stays under whichever one is chosen without anything
                  having to measure where that is. */}
              <span
                aria-hidden="true"
                className={`mx-auto mt-3 block h-0 w-0 border-x-[10px] border-b-[10px] border-x-transparent border-b-white transition-opacity duration-200 ${
                  on ? "opacity-100" : "opacity-0"
                }`}
              />
            </li>
          );
        })}
      </ul>

      <div
        role="tabpanel"
        id="brand-shelf"
        aria-labelledby={`brand-tab-${brand.slug}`}
        className="mx-auto max-w-[1512px] px-4 md:px-6"
      >
        <div className="rounded-2xl bg-white p-3 shadow-card md:p-6">
          {shelf.length > 0 ? (
            <>
              {/* A rail on a phone, five across on a desktop — the same shape
                  every other shelf on this page takes. */}
              {/* A rail at every width, and on a wide screen it is cut to
                  show four and a half: the half card is what says there is
                  more to the right, where five that fit exactly says there
                  is not. */}
              <ul // -m-2 p-2: overflow-x-auto clips on both axes, so without room
                  // inside it the cards' shadows and rounded corners were being
                  // sliced flat against the top and bottom of the rail.
                  className="-m-2 flex snap-x snap-mandatory gap-3 overflow-x-auto p-2 scrollbar-none md:gap-4">
                {shelf.map((p) => (
                  <li
                    key={p.slug}
                    // Two and a half on a phone, three and a half on a
                    // tablet, four and a half on a desktop — the half is the
                    // part that says the rail keeps going.
                    className="w-[calc((100%-1.5rem)/2.5)] shrink-0 snap-start md:w-[calc((100%-3rem)/3.5)] lg:w-[calc((100%-4rem)/4.5)]"
                  >
                    <ProductCard product={p} />
                  </li>
                ))}
              </ul>
              <Link
                href={`/brands/${brand.slug}`}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-600"
              >
                <span translate="no">ดูสินค้า {brand.name} ทั้งหมด</span>
                <ChevronRight size={16} />
              </Link>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">
              ตอนนี้สินค้า <span translate="no">{brand.name}</span> หมดชั่วคราว{" "}
              <Link href={`/brands/${brand.slug}`} className="font-semibold text-brand-800">
                ดูหน้าแบรนด์
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
