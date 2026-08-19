"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Product } from "@/data/types";

export type SocialClip = {
  video: string;
  product?: Product;
};

// The clip's own frame IS the visual — a video element autoplays its first
// frame as a poster once metadata loads, no separate poster image needed
// (these are real vertical Firework CDN clips, not stock photos).
function ClipCard({ clip }: { clip: SocialClip }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function play() {
    setPlaying(true);
    videoRef.current?.play();
  }

  return (
    <div className="w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
      <button
        onClick={play}
        aria-label="เล่นวิดีโอ"
        className="relative block aspect-[9/16] w-full bg-slate-900"
      >
        <video
          ref={videoRef}
          src={clip.video}
          className="h-full w-full object-cover"
          playsInline
          muted
          loop
          controls={playing}
          preload="metadata"
          onEnded={() => setPlaying(false)}
        />
        {!playing && (
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
  const [progress, setProgress] = useState(0);

  function updateProgress() {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 0);
  }

  function scrollByCard(dir: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: dir * 236, behavior: "smooth" });
  }

  if (clips.length === 0) return null;

  return (
    <section className="py-10 md:py-14 overflow-hidden">
      <h2 className="text-center font-extrabold text-2xl md:text-3xl text-brand-ink mb-8">กระแสฮอตบนโซเชียล</h2>
      <div
        ref={scrollerRef}
        onScroll={updateProgress}
        className="flex gap-4 overflow-x-auto scrollbar-none snap-x px-4 md:px-[calc((100%-1120px)/2)]"
      >
        {clips.map((clip, i) => (
          <ClipCard key={i} clip={clip} />
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
            onClick={() => scrollByCard(-1)}
            aria-label="ก่อนหน้า"
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 hover:border-brand-teal transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scrollByCard(1)}
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
