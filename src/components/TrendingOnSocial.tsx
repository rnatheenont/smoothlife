"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Product } from "@/data/types";

export type SocialClip = {
  video: string;
  product?: Product;
};

// The clip's own frame IS the visual — a video element shows its first
// frame as a de facto poster once metadata loads, no separate poster
// image needed (these are real vertical Firework CDN clips, not stock
// photos). Only the active (in-view) card actually plays; the rest sit
// paused on frame 1 as their "cover".
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
    <div ref={cardRef} className="w-[220px] shrink-0 snap-center md:snap-start overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
      <button
        onClick={handleOverlayClick}
        aria-label="เล่นวิดีโอ"
        className="relative block aspect-[9/16] w-full bg-slate-900"
      >
        <video
          ref={videoRef}
          src={clip.video}
          className="h-full w-full object-cover"
          playsInline
          muted
          preload="metadata"
          onEnded={onEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        {!isPlaying && (
          <span className="absolute inset-0 grid place-items-center bg-black/10">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur">
              <Play size={18} className="ml-0.5 fill-white" />
            </span>
          </span>
        )}
      </button>

      <Link
        href={clip.product ? `/product/${clip.product.slug}` : "/shop"}
        className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 hover:bg-surface-soft transition-colors"
      >
        {clip.product ? (
          <>
            <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded bg-surface-soft">
              <Image src={clip.product.image} alt="" fill className="object-cover" />
            </div>
            <span className="min-w-0 flex-1 truncate text-xs text-brand-ink">{clip.product.name}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs text-brand-ink">ช้อปสินค้า</span>
        )}
        <ChevronRight size={14} className="shrink-0 text-slate-400" />
      </Link>
    </div>
  );
}

export default function TrendingOnSocial({ clips }: { clips: SocialClip[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  function updateProgress() {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 0);
  }

  // Programmatic scrollIntoView (below) fires the same intersection
  // observer that's meant to detect the *visitor's own* drag/swipe — mid-
  // animation, a different card can briefly cross the 0.6 threshold and
  // overrule the index goTo() just set, flipping playback to the wrong
  // clip a few hundred ms later. Suppress the observer for the duration
  // of any programmatic scroll so only genuine user scrolling can steer it.
  const suppressObserverRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Single source of truth for "which card plays" — both the auto-advance
  // on video end and the prev/next buttons go through this, so they can
  // never fall out of sync with each other.
  const goTo = useCallback(
    (index: number) => {
      if (clips.length === 0) return;
      const clamped = (index + clips.length) % clips.length;
      setActiveIndex(clamped);
      suppressObserverRef.current = true;
      clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = setTimeout(() => {
        suppressObserverRef.current = false;
      }, 700);
      cardRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    },
    [clips.length]
  );

  // Also detect manual drag/swipe/scroll (not just programmatic goTo calls)
  // so whichever card the visitor scrolls to becomes the one that plays.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || clips.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressObserverRef.current) return;
        const mostVisible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!mostVisible) return;
        const idx = cardRefs.current.indexOf(mostVisible.target as HTMLDivElement);
        if (idx !== -1) setActiveIndex(idx);
      },
      { root, threshold: [0.6] }
    );
    cardRefs.current.forEach((card) => card && observer.observe(card));
    return () => observer.disconnect();
  }, [clips.length]);

  if (clips.length === 0) return null;

  return (
    <section className="py-10 md:py-14 overflow-hidden">
      <h2 className="text-center font-extrabold text-2xl md:text-3xl text-brand-ink mb-8">กระแสฮอตบนโซเชียล</h2>
      <div
        ref={scrollerRef}
        onScroll={updateProgress}
        className="flex gap-4 overflow-x-auto scrollbar-none snap-x px-[calc((100%-220px)/2)] md:px-[calc((100%-1120px)/2)]"
      >
        {clips.map((clip, i) => (
          <ClipCard
            key={i}
            clip={clip}
            active={i === activeIndex}
            onEnded={() => goTo(i + 1)}
            onSelect={() => goTo(i)}
            cardRef={(el) => {
              cardRefs.current[i] = el;
            }}
          />
        ))}
      </div>
      <div className="mt-5 flex items-center gap-4 px-4 md:px-[calc((100%-1120px)/2)]">
        <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-ink transition-[width]"
            style={{ width: `${Math.max(8, progress * 100)}%` }}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => goTo(activeIndex - 1)}
            aria-label="ก่อนหน้า"
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 hover:border-brand-teal transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => goTo(activeIndex + 1)}
            aria-label="ถัดไป"
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 hover:border-brand-teal transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
