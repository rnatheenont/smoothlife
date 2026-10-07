"use client";

import { useEffect, useRef, useState } from "react";
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
// It moves one banner at a time, not three. Replacing the whole row meant
// every banner you had just started reading left at once; sliding by one
// keeps two of the three where they were, so the row reads as a queue moving
// past rather than as three unrelated posters taking turns.
//
// Because it is hidden rather than unmounted below lg, none of these images
// may be `priority`: next/image lazy-loads by default and a display:none
// element never intersects, so a phone downloads none of them. An eager one
// would be fetched on every phone to be shown on none of them.

const PER_VIEW = 3;
const AUTO_ROTATE_MS = 5000;
const SLIDE_MS = 600;

// The artwork is 2000x1060 (1.89). A 16/9 tile trims about 6% off the sides
// — inside the 10% the full-width hero allows itself before it stops cropping
// — and is enough taller than the artwork's own shape to read as a row of
// cards rather than a row of letterbox strips.
export default function HeroTrio({ banners }: { banners: HeroBanner[] }) {
  const n = banners.length;
  const slides = n > PER_VIEW;

  // The track holds three copies of the list and starts in the middle one, so
  // there is always a banner to slide in from either side. `index` is allowed
  // to walk off the middle copy and is quietly carried back once the slide has
  // finished — landing exactly one copy away is the same picture, so the jump
  // cannot be seen.
  const [index, setIndex] = useState(n);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const recentre = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!slides || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => i + 1), AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [slides, paused]);

  useEffect(() => {
    if (!slides) return;
    if (index >= n && index < n * 2) return;
    recentre.current = window.setTimeout(() => {
      setAnimate(false);
      setIndex((((index % n) + n) % n) + n);
    }, SLIDE_MS);
    return () => clearTimeout(recentre.current);
  }, [index, n, slides]);

  // Put the transition back a frame after the silent jump, never in the same
  // one: a transition still attached when the transform changes would animate
  // the jump itself, which is the whole thing this is avoiding.
  useEffect(() => {
    if (animate) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setAnimate(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [animate]);

  if (n === 0) return null;

  const track = slides ? [...banners, ...banners, ...banners] : banners;
  const step = 100 / PER_VIEW;
  // Of the three on screen, the middle one is the campaign being shown; the
  // other two are what it came from and what it is going to.
  const middle = slides ? index + 1 : 1;

  return (
    <div
      className="hidden lg:block"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="group relative mx-auto max-w-[1512px] px-4 md:px-6">
        {/* The gap is half of it on each side of every tile, so a tile is
            exactly a third of the track and one step is one tile — a `gap`
            between them would make the step a third plus a gap, and the row
            would creep. The window is pulled out by that half-gap so the
            first and last images still sit flush with the page, and by a
            little more top and bottom so hover shadows are not sliced off by
            the same overflow that hides the queue. */}
        <div className="-mx-2.5 -my-7 overflow-hidden py-7">
          <ul
            className="flex items-center"
            style={{
              transform: `translateX(-${(slides ? index : 0) * step}%)`,
              transition: animate ? `transform ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1)` : "none",
            }}
          >
            {track.map((b, i) => (
              // Every tile is the same third of the track, so one step is
              // always one tile; what makes the middle one bigger is a scale
              // on top of that, which costs the row nothing in arithmetic.
              // 1.14 and 0.9 are as far apart as they go before the tiles
              // touch: the middle grows 42px towards its neighbour, the
              // neighbour backs off 28px, and the 20px between them has 11px
              // left. The scale rides the same clock as the slide, so a tile
              // grows into the middle as it arrives rather than after.
              <li
                key={`${i}-${b.slug}`}
                className="w-1/3 shrink-0 px-2.5"
                style={{
                  transform: `scale(${i === middle ? 1.14 : 0.9})`,
                  zIndex: i === middle ? 1 : 0,
                  transition: animate ? `transform ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1)` : "none",
                }}
              >
                <Link
                  href={b.href}
                  className="relative block aspect-video overflow-hidden rounded-2xl bg-surface-soft transition-shadow duration-300 hover:shadow-cardHover"
                >
                  <Image
                    src={b.image}
                    alt={b.title ?? ""}
                    fill
                    sizes="(max-width:1512px) 38vw, 560px"
                    className="object-cover"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {slides && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              aria-label="แบนเนอร์ก่อนหน้า"
              className="absolute left-7 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-ink opacity-0 shadow-card transition-opacity hover:bg-white group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              aria-label="แบนเนอร์ถัดไป"
              className="absolute right-7 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-ink opacity-0 shadow-card transition-opacity hover:bg-white group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {slides && (
        // One dot per banner now that the step is one banner. The lit dot is
        // the leftmost of the three on screen.
        <div className="mt-4 flex justify-center gap-2">
          {banners.map((b, i) => {
            const active = (((index % n) + n) % n) === i;
            return (
              <button
                key={b.slug}
                type="button"
                onClick={() => setIndex(n + i)}
                aria-label={`แบนเนอร์ที่ ${i + 1}`}
                aria-current={active || undefined}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  active ? "w-8 bg-brand-teal" : "w-5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
