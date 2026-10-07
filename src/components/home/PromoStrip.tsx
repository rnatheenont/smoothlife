"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { promotions } from "@/data/promotions";

// The wide deal strip between the category row and the first shelf.
//
// The design's is a flat artwork the merchandising team drew — a Thai
// headline over a green field with a next arrow on the right. There is no
// strip-shaped artwork in the repo (the promo photographs are 4:3, and a 4:3
// photograph in a 7:1 box is 80% cropped away), so this is drawn rather than
// placed: same shape, same job, and the copy comes from the real promotions
// instead of being baked into a picture nobody can edit.
//
// Swapping it for the real artwork later is a `stripImage` on Promotion and
// an <Image> in place of the gradient.

const AUTO_ROTATE_MS = 7000;

export default function PromoStrip() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = promotions.length;

  useEffect(() => {
    if (paused || count <= 1) return;
    const timer = setInterval(() => setI((n) => (n + 1) % count), AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, count, i]);

  if (count === 0) return null;
  const promo = promotions[i];

  return (
    <section className="py-6 md:py-9">
      <div
        className="relative mx-auto max-w-[1512px] px-4 md:px-6"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <Link
          href={`/promotions#${promo.slug}`}
          className="relative block overflow-hidden rounded-2xl bg-brand-gradient transition-shadow duration-300 hover:shadow-cardHover"
        >
          {/* A sheen across the field so it is not a flat rectangle of green.
              Decorative, so it never needs a reader to know about it. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_180%_at_85%_0%,rgba(255,255,255,0.28),transparent_55%)]"
          />
          <div className="relative flex min-h-[112px] items-center gap-4 px-5 py-6 pr-16 md:min-h-[180px] md:px-10 md:pr-28">
            <div className="min-w-0">
              <span className="inline-block rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-brand-800">
                {promo.badge}
              </span>
              <p className="mt-2.5 text-xl font-bold leading-snug text-white md:mt-3 md:text-[32px] lg:text-[38px]">
                {promo.subtitle}
              </p>
            </div>
          </div>
        </Link>

        {/* A sibling of the link, not a child of it: a button inside an
            anchor is a hit area that does two different things depending on
            which pixel is pressed. */}
        {count > 1 && (
          <button
            type="button"
            onClick={() => setI((n) => (n + 1) % count)}
            aria-label="ดีลถัดไป"
            className="absolute right-8 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-800 shadow-card transition-transform hover:scale-105 active:scale-95 md:right-14 md:h-16 md:w-16"
          >
            <ChevronRight size={24} className="md:hidden" />
            <ChevronRight size={32} className="hidden md:block" />
          </button>
        )}
      </div>
    </section>
  );
}
