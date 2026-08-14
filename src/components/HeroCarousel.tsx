"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { heroBanners } from "@/data/heroBanners";

const AUTO_ROTATE_MS = 5000;

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % heroBanners.length);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

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

  const banner = heroBanners[index];

  return (
    <div
      className="relative aspect-[4/3] md:aspect-[16/9] rounded-xl2 overflow-hidden shadow-cardHover select-none touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <Link href={banner.href} className="block absolute inset-0">
        <Image
          src={banner.image}
          alt={banner.title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
        <div className="absolute bottom-0 left-0 p-4 md:p-6 text-white">
          <span className="text-[10px] font-bold uppercase bg-white/20 backdrop-blur px-2.5 py-1 rounded-full">
            {banner.title}
          </span>
          <p className="text-xs md:text-sm text-white/80 mt-2">{banner.subtitle}</p>
        </div>
      </Link>

      {heroBanners.length > 1 && (
        <>
          <button
            onClick={() => showAt(index - 1)}
            aria-label="ก่อนหน้า"
            className="hidden md:grid absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 place-items-center rounded-full bg-white/80 hover:bg-white text-brand-ink shadow-sm transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => showAt(index + 1)}
            aria-label="ถัดไป"
            className="hidden md:grid absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 place-items-center rounded-full bg-white/80 hover:bg-white text-brand-ink shadow-sm transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            {heroBanners.map((b, i) => (
              <button
                key={b.slug}
                onClick={() => showAt(i)}
                aria-label={`ไปที่แบนเนอร์ ${i + 1}`}
                className={`h-1.5 rounded-full transition-all shadow-[0_0_0_1px_rgba(0,0,0,0.15)] ${
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
