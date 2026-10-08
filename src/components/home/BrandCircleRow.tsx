"use client";

import { useMemo, useRef, useState } from "react";
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

/** Ten in the rail, six of them whole and a seventh fading out at the edge:
 *  the fade only means anything while there is still something behind it. */
const SHOWN = 10;

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

  // A plain ref. The rails used to carry a gradient mask that faded the
  // cut-off card at each end; it is gone at every width now, so there is
  // nothing left for a hook to hold but this.
  const railRef = useRef<HTMLUListElement>(null);
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
        // The tile is 96px around an 88px circle, so the label has somewhere
        // to go — which means 8px of the space between two circles is
        // already spoken for before the gap is counted. At gap-5 that came
        // to 28px of nothing between them and the row read as scattered
        // rather than as one set, the same way the category row did at the
        // same distance. 10px here puts the circles 18px apart, in step with
        // the 16px of that row above it.
        // The row stops scrolling and centres itself at xl, not lg. Nine
        // 116px circles need 1208px with the smallest gap the clamp allows,
        // and at lg the page has 976 — so `lg:overflow-visible` took the
        // scrollbar away from a row that still did not fit: measured at
        // 1024px, the first circle sat at x=-76 and the last ended at 1100,
        // with no way to reach either. (The same mistake the category row
        // above it was making, fixed the same way.)
        className="mx-auto flex max-w-[1512px] gap-2.5 overflow-x-auto px-4 pt-2 scrollbar-none md:px-6 xl:justify-center xl:gap-[clamp(0.75rem,1.6vw,1.5rem)] xl:overflow-visible"
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
            </li>
          );
        })}
      </ul>

      <div
        role="tabpanel"
        id="brand-shelf"
        aria-labelledby={`brand-tab-${brand.slug}`}
        // mt-8: the little notch used to hold the shelf off the brand names;
        // with it gone the cards were sitting on top of the labels.
        className="mx-auto mt-10 max-w-[1512px] px-4 md:px-6"
      >
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
                  ref={railRef}
                  className="-m-2 flex snap-x snap-mandatory gap-3 overflow-x-auto p-2 scrollbar-none md:gap-4">
                {shelf.map((p) => (
                  <li
                    key={p.slug}
                    // Two and a half on a phone, three and a half on a
                    // tablet, six and a half on a desktop — the part-card is
                    // what says the rail keeps going.
                    className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start md:w-[calc((100%-3rem)/3.5)] lg:w-[calc((100%-6rem)/6.5)]"
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
  );
}
