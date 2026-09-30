"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HeroBanner } from "@/data/heroBanners";

const AUTO_ROTATE_MS = 8000;

// Shopify serves two crops of the same campaign — a wide one for the desktop
// slideshow and a square one for phones — and this component only ever drew
// the wide one. On a phone that put a 3200px-wide artwork inside a strip a
// little over half as tall as it was wide, so the words on it arrived about
// the size of the small print.
const MOBILE_QUERY = "(max-width: 767px)";

function useIsMobile() {
  // Server-rendered as desktop and corrected on mount: a phone loads the wide
  // crop for a moment, which is the cost of not shipping both to everyone.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isMobile;
}

export default function HeroCarousel({ banners: heroBanners }: { banners: HeroBanner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const isMobile = useIsMobile();

  // One frame for the whole carousel, not one per slide: a box that changed
  // shape every eight seconds would shove the page down and up beneath it.
  // Square only when every slide has a square crop to fill it — the banners
  // read live from the storefront do not carry one, and a wide artwork in a
  // square box is mostly blurred bar.
  const everySlideHasMobileCrop = heroBanners.every((b) => Boolean(b.mobileImage));
  const mobileAspect = everySlideHasMobileCrop ? "aspect-square" : "aspect-4/3";

  useEffect(() => {
    if (paused || heroBanners.length === 0) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % heroBanners.length);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, heroBanners.length]);

  if (heroBanners.length === 0) return null;

  function showAt(i: number) {
    setIndex((i + heroBanners.length) % heroBanners.length);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const SWIPE_THRESHOLD = 40;
    if (delta > SWIPE_THRESHOLD) showAt(index - 1);
    else if (delta < -SWIPE_THRESHOLD) showAt(index + 1);
  }

  return (
    <div>
      <div
        className={`group relative ${mobileAspect} md:aspect-100/53 rounded-surface overflow-hidden select-none touch-pan-y bg-surface-soft`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* All slides stacked + cross-faded, instead of hard-swapping — reads
            as a premium transition instead of a jump cut. */}
        {heroBanners.map((banner, i) => (
          <Link
            key={banner.slug}
            href={banner.href}
            aria-hidden={i !== index}
            tabIndex={i === index ? 0 : -1}
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{ opacity: i === index ? 1 : 0, pointerEvents: i === index ? "auto" : "none" }}
          >
            {/* The banner's own colours, blurred, behind it.
                Artwork arrives at whatever shape the designer worked in, and
                the frame is a fixed 100:53. Cropping to fill it cut the edges
                off anything taller or wider — usually the bit with the date or
                the logo on it. Showing the whole image instead leaves bars, so
                the bars are filled with the image itself, out of focus: the
                banner keeps its own palette rather than sitting in a grey box,
                and it changes with the slide because each slide carries one.

                Deliberately fetched small. It is going to be blurred beyond
                recognition, so a thumbnail's worth of pixels is plenty and the
                page does not download every banner twice at full size. */}
            <Image
              src={isMobile ? (banner.mobileImage ?? banner.image) : banner.image}
              alt=""
              aria-hidden
              fill
              sizes="64px"
              className="scale-110 object-cover blur-2xl"
            />
            <Image
              src={isMobile ? (banner.mobileImage ?? banner.image) : banner.image}
              alt={banner.title}
              fill
              priority={i === 0}
              sizes="(max-width: 767px) 100vw, (max-width: 1280px) 55vw, 700px"
              className="object-contain"
            />
          </Link>
        ))}

        {heroBanners.length > 1 && (
          <>
            <button
              onClick={() => showAt(index - 1)}
              aria-label="ก่อนหน้า"
              className="hidden md:grid absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 place-items-center rounded-full bg-white/80 hover:bg-white text-brand-ink shadow-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => showAt(index + 1)}
              aria-label="ถัดไป"
              className="hidden md:grid absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 place-items-center rounded-full bg-white/80 hover:bg-white text-brand-ink shadow-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {/* Pagination moved below the frame instead of overlaid on the image
          — sits on the page background now, not the photo, so it needs its
          own (dark-on-light) palette rather than the white-on-photo one. */}
      {heroBanners.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {heroBanners.map((b, i) => (
            <button
              key={b.slug}
              onClick={() => showAt(i)}
              aria-label={`ไปที่แบนเนอร์ ${i + 1}`}
              className="relative h-1.5 w-5 rounded-full overflow-hidden bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
            >
              {i === index && (
                <span
                  key={`${b.slug}-${paused}`}
                  className="absolute inset-y-0 left-0 bg-brand-gradient rounded-full"
                  style={{
                    animation: paused ? "none" : `heroFill ${AUTO_ROTATE_MS}ms linear forwards`,
                    width: paused ? "100%" : undefined,
                  }}
                />
              )}
              {i < index && <span className="absolute inset-0 bg-brand-gradient rounded-full" />}
            </button>
          ))}
          <style jsx>{`
            @keyframes heroFill {
              from {
                width: 0%;
              }
              to {
                width: 100%;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
