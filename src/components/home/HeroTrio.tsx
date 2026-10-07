"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroBanner } from "@/data/heroBanners";

// The campaign banners three across, on a screen wide enough to read three.
//
// The phone keeps the single full-bleed carousel — the wide crop is already
// most of a phone screen on its own, and a third of one is a thumbnail. So
// this is lg and up only, and it is a separate component rather than a mode
// of HeroCarousel: that one measures each slide against its frame to decide
// whether it can be cropped, carries the square phone crops and can rebuild
// a campaign as a 3D scene, and none of that survives being a third as wide.
//
// Because it is hidden rather than unmounted below lg, none of these images
// may be `priority`: next/image lazy-loads by default and a display:none
// element never intersects, so a phone downloads none of them. An eager one
// would be fetched on every phone to be shown on none of them.

const PER_PAGE = 3;
const AUTO_ROTATE_MS = 8000;

// The artwork is 2000x1060 (1.89). A 16/9 tile trims about 6% off the sides
// — inside the 10% the full-width hero allows itself before it stops cropping
// — and is enough taller than the artwork's own shape to read as a row of
// cards rather than a row of letterbox strips.
export default function HeroTrio({ banners }: { banners: HeroBanner[] }) {
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const pages = Math.ceil(banners.length / PER_PAGE);

  useEffect(() => {
    if (paused || pages <= 1) return;
    const timer = setInterval(() => setPage((p) => (p + 1) % pages), AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, pages, page]);

  if (banners.length === 0) return null;
  // Pages wrap rather than running short: six banners divide into two rows of
  // three, five would leave the last row a third empty, and a repeated banner
  // beside two new ones reads better than a hole beside them. Under three
  // banners there is nothing to repeat from, so the row is just short.
  const shown =
    banners.length < PER_PAGE
      ? banners
      : Array.from({ length: PER_PAGE }, (_, i) => banners[(page * PER_PAGE + i) % banners.length]);

  return (
    <div
      className="hidden lg:block"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="group relative mx-auto max-w-[1512px] px-4 md:px-6">
        {/* Keyed on the page so a new set fades in rather than swapping; the
            tiles are remounted, which is also what lets the next page's
            images stay unfetched until it is actually shown. */}
        <ul key={page} className="grid grid-cols-3 gap-5 motion-safe:animate-fadeUp">
          {shown.map((b) => (
            <li key={`${page}-${b.slug}`}>
              <Link
                href={b.href}
                className="relative block aspect-video overflow-hidden rounded-2xl bg-surface-soft transition-shadow duration-300 hover:shadow-cardHover"
              >
                <Image
                  src={b.image}
                  alt={b.title ?? ""}
                  fill
                  sizes="(max-width:1512px) 33vw, 490px"
                  className="object-cover"
                />
              </Link>
            </li>
          ))}
        </ul>

        {pages > 1 && (
          <>
            <button
              type="button"
              onClick={() => setPage((p) => (p - 1 + pages) % pages)}
              aria-label="แบนเนอร์ก่อนหน้า"
              className="absolute left-7 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-ink opacity-0 shadow-card transition-opacity hover:bg-white group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => (p + 1) % pages)}
              aria-label="แบนเนอร์ถัดไป"
              className="absolute right-7 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-ink opacity-0 shadow-card transition-opacity hover:bg-white group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              aria-label={`แบนเนอร์ชุดที่ ${i + 1}`}
              aria-current={i === page || undefined}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === page ? "w-8 bg-brand-teal" : "w-5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
