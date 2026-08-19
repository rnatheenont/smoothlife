"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { Play, ShoppingBag } from "lucide-react";
import { Product } from "@/data/types";
import StarRating from "./StarRating";
import clsx from "clsx";

const DWELL_MS = 2800; // how long a card sits "playing" front-and-center before advancing
const TRANSITION = 0.6;
const SLOT_XPERCENT = 78; // how far apart (as % of one card's own width) each step sits
const VISIBLE_RANGE = 3; // cards further than this from center fade out entirely
const DRAG_THRESHOLD_PX = 50;

function circularOffset(index: number, center: number, length: number) {
  let diff = index - center;
  if (diff > length / 2) diff -= length;
  if (diff < -length / 2) diff += length;
  return diff;
}

function CardFace({ p, active }: { p: Product; active: boolean }) {
  return (
    <>
      <Image
        src={p.image}
        alt={p.name}
        fill
        draggable={false}
        sizes="(max-width: 768px) 40vw, 208px"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />

      <span className="absolute right-2.5 top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/25 backdrop-blur text-white">
        <ShoppingBag size={14} />
      </span>

      <span className="absolute inset-0 grid place-items-center">
        <span
          className={clsx(
            "grid place-items-center rounded-full bg-white/90 text-brand-ink shadow-lg transition-transform",
            active ? "h-12 w-12 md:h-14 md:w-14 scale-100" : "h-9 w-9 scale-90 opacity-80"
          )}
        >
          <Play size={active ? 20 : 15} className="fill-brand-ink ml-0.5" />
        </span>
      </span>

      <div className="absolute inset-x-0 bottom-0 p-3">
        {p.reviewCount > 0 && (
          <div className="mb-1 scale-90 origin-left">
            <StarRating rating={p.rating} size={11} />
          </div>
        )}
        <p className="text-xs md:text-sm font-bold text-white line-clamp-2 leading-snug">{p.name}</p>
        {active && (
          <span className="mt-1.5 inline-flex items-center rounded-full bg-white text-brand-ink text-[10px] font-bold px-2 py-1">
            ดูสินค้า
          </span>
        )}
      </div>
    </>
  );
}

// A social/UGC-style "reels" strip styled after GSAP's infinite card-slider
// pattern (demos.gsap.com/demo/infinite-card-slider) — the centered card
// sits big and sharp like it's "playing", the rest recede in scale/opacity
// on either side. We don't have licensed video files to actually play, so
// each card shows that product's real catalogue photo as its poster and
// links to its real product page; the coverflow shows off the visual
// language of the reference without faking video playback.
//
// Auto-advances on a timer (each card gets a "playing" dwell up front,
// then slides on) and loops forever. Dragging the stage — or tapping a
// side card — recenters manually and pauses the auto-advance briefly so a
// shopper's interaction never fights it.
export default function ShoppableReels({ products }: { products: Product[] }) {
  const [centerIndex, setCenterIndex] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragMovedRef = useRef(false);
  const isFirstRender = useRef(true);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const length = products.length;

  function applyLayout(center: number, animate: boolean) {
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const offset = circularOffset(i, center, length);
      const abs = Math.abs(offset);
      const vars = {
        xPercent: offset * SLOT_XPERCENT,
        scale: Math.max(1 - abs * 0.16, 0.5),
        opacity: abs > VISIBLE_RANGE ? 0 : Math.max(1 - abs * 0.24, 0),
        zIndex: 100 - abs,
        duration: animate ? TRANSITION : 0,
        ease: "power2.inOut",
      };
      if (animate) gsap.to(el, vars);
      else gsap.set(el, vars);
    });
  }

  useEffect(() => {
    applyLayout(centerIndex, !isFirstRender.current);
    isFirstRender.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerIndex, length]);

  useEffect(() => {
    if (length === 0) return;
    function tick() {
      if (!pausedRef.current) {
        setCenterIndex((i) => (i + 1) % length);
      }
    }
    intervalRef.current = setInterval(tick, DWELL_MS);
    return () => clearInterval(intervalRef.current);
  }, [length]);

  function pauseFor(ms = 4000) {
    pausedRef.current = true;
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, ms);
  }

  function handlePointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    dragMovedRef.current = false;
    dragStartXRef.current = e.clientX;
    pausedRef.current = true;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const delta = e.clientX - dragStartXRef.current;
    if (Math.abs(delta) > DRAG_THRESHOLD_PX && !dragMovedRef.current) {
      dragMovedRef.current = true;
      setCenterIndex((i) => (delta < 0 ? (i + 1) % length : (i - 1 + length) % length));
      dragStartXRef.current = e.clientX;
    }
  }

  function handlePointerUp() {
    draggingRef.current = false;
    pauseFor();
  }

  if (length === 0) return null;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => !draggingRef.current && (pausedRef.current = false)}
      className="relative mx-auto h-[67vw] sm:h-[300px] md:h-[355px] max-w-full overflow-hidden touch-pan-y cursor-grab active:cursor-grabbing select-none"
    >
      {products.map((p, i) => {
        const isCenter = i === centerIndex;
        return (
          <div
            key={p.slug}
            className="absolute left-1/2 top-0 w-[38vw] sm:w-44 md:w-52 aspect-[9/16] -translate-x-1/2"
          >
            <div
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="absolute inset-0"
            >
              {isCenter ? (
                <Link
                  href={`/product/${p.slug}`}
                  draggable={false}
                  onClick={(e) => dragMovedRef.current && e.preventDefault()}
                  className="group relative block h-full w-full rounded-2xl overflow-hidden bg-slate-900 shadow-cardHover ring-2 ring-white/80"
                >
                  <CardFace p={p} active />
                </Link>
              ) : (
                <button
                  type="button"
                  draggable={false}
                  onClick={() => {
                    if (!dragMovedRef.current) {
                      setCenterIndex(i);
                      pauseFor();
                    }
                  }}
                  className="relative block h-full w-full rounded-2xl overflow-hidden bg-slate-900 shadow-card text-left"
                >
                  <CardFace p={p} active={false} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
