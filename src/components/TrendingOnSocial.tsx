"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play, Volume2, VolumeX, ShoppingCart, Check } from "lucide-react";
import SocialBubbles from "@/components/home/SocialBubbles";
import { Product } from "@/data/types";
import { useCart } from "@/lib/cart-context";

export type SocialClip = {
  video: string;
  product?: Product;
};

/** A media fragment asking the browser to land on a frame a tenth of a
 *  second in, rather than on nothing. Left off a URL that already has one. */
function posterFrameSrc(url: string) {
  return url.includes("#t=") ? url : `${url}#t=0.1`;
}

// Only the active (in-view) card plays; the rest sit on a cover frame.
//
// That cover used to be the video's own first frame, on the assumption that
// `preload="metadata"` paints one. It does not, reliably — most browsers
// fetch the header and stop, and the row rendered as five black rectangles
// with a play button floating in each. Two fixes, because the clips differ:
// a clip tied to a product uses that product's packshot as its poster (the
// same picture as the row below it, so the card reads as one thing), and
// every clip's source carries a `#t=0.1` fragment, which asks the browser
// to seek to a real frame and paint it.
function ClipCard({
  clip,
  active,
  onEnded,
  onSelect,
  cardRef,
}: {
  clip: SocialClip;
  active: boolean;
  onEnded: () => void;
  onSelect: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    if (!clip.product) return;
    addItem(clip.product.slug);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active]);

  // Autoplay can be blocked by the browser (varies by device/network/policy),
  // which would otherwise leave the active card paused with no way to
  // recover, since the play button only rendered for inactive cards. Track
  // real playback state so a blocked autoplay still shows a tappable button.
  function handleOverlayClick() {
    if (active) {
      videoRef.current?.play().catch(() => {});
    } else {
      onSelect();
    }
  }

  return (
    <div
      ref={cardRef}
      className="overflow-hidden rounded-2xl bg-white shadow-card"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleOverlayClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleOverlayClick();
        }}
        aria-label="เล่นวิดีโอ"
        className="relative block aspect-9/16 w-full bg-slate-900 cursor-pointer"
      >
        <video
          ref={videoRef}
          src={posterFrameSrc(clip.video)}
          poster={clip.product?.image}
          className="h-full w-full object-cover"
          playsInline
          muted={muted}
          preload="metadata"
          onEnded={onEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        {!isPlaying && (
          <span className="absolute inset-0 grid place-items-center bg-black/10">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm">
              <Play size={18} className="ml-0.5 fill-white" />
            </span>
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMuted((m) => !m);
          }}
          aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}
          className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm"
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </div>

      {/* Only the clip that is playing carries its product. On the cards
          either side it would be a line of unreadable text under a shrunken,
          half-faded video — the design shows those as plain frames, and that
          is also what they are good for. */}
      {active && (
      <div className="flex items-center gap-2 border-t border-slate-100 pl-3 pr-2 py-2">
        <Link
          href={clip.product ? `/product/${clip.product.slug}` : "/shop"}
          className="flex min-w-0 flex-1 items-center gap-3 py-1 hover:opacity-80 transition-opacity"
        >
          {clip.product ? (
            <>
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-soft">
                <Image src={clip.product.image} alt="" fill className="object-cover" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-brand-ink">{clip.product.name}</span>
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-brand-ink">ช้อปสินค้า</span>
          )}
        </Link>
        {clip.product && (
          <button
            onClick={handleAdd}
            aria-label="เพิ่มลงตะกร้า"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-90 ${
              added ? "bg-brand-emerald text-white" : "bg-brand-gradient text-white hover:opacity-90"
            }`}
          >
            {added ? <Check size={15} /> : <ShoppingCart size={15} />}
          </button>
        )}
      </div>
      )}
    </div>
  );
}


const SWIPE_THRESHOLD = 40;

/** Where a card sits, given how far it is from the one in the middle. No
 *  rotation here, unlike the concern stack: these are phone-shaped videos
 *  and tilting them reads as a broken screen rather than as depth. */
function placement(offset: number) {
  const side = Math.sign(offset);
  const distance = Math.abs(offset);
  if (distance === 0) return { x: 0, scale: 1, z: 30, opacity: 1, shown: true };
  if (distance === 1) return { x: side * 92, scale: 0.78, z: 20, opacity: 0.55, shown: true };
  if (distance === 2) return { x: side * 168, scale: 0.66, z: 10, opacity: 0.3, shown: true };
  return { x: side * 230, scale: 0.6, z: 0, opacity: 0, shown: false };
}

export default function TrendingOnSocial({ clips, initialIndex = 0 }: { clips: SocialClip[]; initialIndex?: number }) {
  const [active, setActive] = useState(() =>
    clips.length && initialIndex >= 0 ? initialIndex % clips.length : 0
  );
  const dragX = useRef<number | null>(null);
  const count = clips.length;

  // Shortest way round, so stepping off either end wraps instead of flying
  // the whole stack across the screen.
  function offsetOf(i: number) {
    let d = i - active;
    if (d > count / 2) d -= count;
    if (d < -count / 2) d += count;
    return d;
  }
  const step = (d: number) => setActive((i) => (i + d + count) % count);

  function onPointerDown(e: ReactPointerEvent) {
    dragX.current = e.clientX;
  }
  function onPointerUp(e: ReactPointerEvent) {
    const from = dragX.current;
    dragX.current = null;
    if (from === null) return;
    const dx = e.clientX - from;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) step(dx < 0 ? 1 : -1);
  }

  if (count === 0) return null;

  return (
    <section className="relative isolate overflow-hidden py-7 md:py-14 lg:py-16">
      <SocialBubbles />

      {/* Centred, unlike the other section headings: this stack is centred
          on the page and a heading hanging off to the left of it reads as
          belonging to something else. */}
      <h2 className="container-page text-center text-xl font-bold text-brand-ink md:text-2xl">
        กระแสฮอตบนโซเชียล
      </h2>

      <div
        // --spread pulls the neighbours in on a narrow screen. The offsets
        // below are percentages of a card's own width, which holds its shape
        // at any size — but a phone is only about one and a half cards wide,
        // so the full spread left a 60px sliver of each neighbour where a
        // desktop shows most of one.
        className="relative mx-auto mt-6 h-[520px] w-full max-w-[1512px] touch-pan-y select-none [--spread:0.74] md:mt-9 md:h-[600px] md:[--spread:1]"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (dragX.current = null)}
      >
        {clips.map((clip, i) => {
          const p = placement(offsetOf(i));
          return (
            <div
              key={i}
              aria-hidden={!p.shown}
              style={{
                transform: `translate(-50%, -50%) translate(calc(${p.x}% * var(--spread)), 0) scale(${p.scale})`,
                zIndex: p.z,
                opacity: p.opacity,
              }}
              className="absolute left-1/2 top-1/2 w-[min(64vw,300px)] transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none"
            >
              <ClipCard
                clip={clip}
                active={i === active}
                onEnded={() => step(1)}
                onSelect={() => setActive(i)}
                cardRef={() => {}}
              />
            </div>
          );
        })}

        {/* Outside the stack, so a press never lands on whichever card
            happens to be underneath them. */}
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="คลิปก่อนหน้า"
          // Hidden on a phone: there is no room for them beside the stack,
          // so they end up sitting on the clips — and a thumb there swipes
          // rather than aims at a 40px target.
          className="absolute left-3 top-1/2 z-40 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-ink shadow-card transition-colors hover:bg-white md:left-8 md:grid lg:left-16"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="คลิปถัดไป"
          className="absolute right-3 top-1/2 z-40 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-ink shadow-card transition-colors hover:bg-white md:right-8 md:grid lg:right-16"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {clips.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`คลิปที่ ${i + 1}`}
            aria-current={i === active || undefined}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-7 bg-brand-teal" : "w-4 bg-slate-300 hover:bg-slate-400"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
