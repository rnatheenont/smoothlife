"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HeroBanner } from "@/data/heroBanners";

const AUTO_ROTATE_MS = 8000;

export default function HeroCarousel({ banners: heroBanners }: { banners: HeroBanner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  if (heroBanners.length === 0) return null;

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % heroBanners.length);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused]);

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
    <div
      className="group relative aspect-[4/3] md:aspect-[16/9] rounded-xl2 overflow-hidden shadow-cardHover select-none touch-pan-y bg-surface-soft"
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
          {/* Blurred, scaled-up copy of the same slide fills the letterbox
              behind it — switches with the slide since it's the same image,
              instead of leaving flat empty bars around images that don't
              match the banner's aspect ratio. */}
          <Image
            src={banner.image}
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover scale-125 blur-2xl brightness-75"
          />
          <Image
            src={banner.image}
            alt={banner.title}
            fill
            priority={i === 0}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain"
          />
          {(banner.title || banner.subtitle) && (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white">
                {banner.title && (
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur px-2.5 py-1 rounded-full">
                    {banner.title}
                  </span>
                )}
                {banner.subtitle && (
                  <p className="text-base md:text-xl font-bold leading-snug mt-2 drop-shadow-sm">{banner.subtitle}</p>
                )}
              </div>
            </>
          )}
        </Link>
      ))}

      {heroBanners.length > 1 && (
        <>
          <button
            onClick={() => showAt(index - 1)}
            aria-label="ก่อนหน้า"
            className="hidden md:grid absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 place-items-center rounded-full bg-white/80 hover:bg-white text-brand-ink shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => showAt(index + 1)}
            aria-label="ถัดไป"
            className="hidden md:grid absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 place-items-center rounded-full bg-white/80 hover:bg-white text-brand-ink shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {heroBanners.map((b, i) => (
              <button
                key={b.slug}
                onClick={() => showAt(i)}
                aria-label={`ไปที่แบนเนอร์ ${i + 1}`}
                className="relative h-1.5 w-5 rounded-full overflow-hidden bg-white/30 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
              >
                {i === index && (
                  <span
                    key={`${b.slug}-${paused}`}
                    className="absolute inset-y-0 left-0 bg-white rounded-full"
                    style={{
                      animation: paused ? "none" : `heroFill ${AUTO_ROTATE_MS}ms linear forwards`,
                      width: paused ? "100%" : undefined,
                    }}
                  />
                )}
                {i < index && <span className="absolute inset-0 bg-white rounded-full" />}
              </button>
            ))}
          </div>
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
        </>
      )}
    </div>
  );
}
