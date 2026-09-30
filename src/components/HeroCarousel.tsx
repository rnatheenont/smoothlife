"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HeroBanner } from "@/data/heroBanners";
import { hero3DSceneFor } from "@/data/hero-3d";

// Three.js and four layer images, a megabyte between them, for one slide of
// one campaign — kept out of the page's own bundle and fetched only once a
// desktop actually renders a slide that has a scene.
const HeroScene3D = dynamic(() => import("@/components/hero/HeroScene3D"), {
  ssr: false,
});

const AUTO_ROTATE_MS = 8000;

// Shopify serves two crops of the same campaign — a wide one for the desktop
// slideshow and a square one for phones — and this component only ever drew
// the wide one. On a phone that put a 3200px-wide artwork inside a strip a
// little over half as tall as it was wide, so the words on it arrived about
// the size of the small print.
const MOBILE_QUERY = "(max-width: 767px)";

// How much of a slide the frame may crop away before it stops cropping and
// shows the whole image instead, on its own blurred colours. Both numbers are
// small, and the vertical one had to come down: these creatives are not drawn
// with air around the message the way a photograph would be. Measured on the
// Winter Festival banner, the brand logo begins 2.8% from the top edge and
// the venue address ends 4.4% from the bottom, so a frame wider than the
// artwork — which is every screen past about 1700px, since the banner is
// capped in height — was filling itself by cutting both of them off.
const CROP_LIMIT_VERTICAL = 0.06;
const CROP_LIMIT_HORIZONTAL = 0.1;

function useIsMobile() {
  // Three states, not two. Server-rendered as unknown and settled on mount: a
  // phone loads the wide crop for a moment, which is the cost of not shipping
  // both to everyone — but "not yet known" has to be distinguishable from
  // "known to be a desktop", because the 3D scene downloads three.js the
  // instant it renders. Treating unknown as desktop had every phone fetch
  // half a megabyte of it before the media query came back and unmounted it.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isMobile;
}

export default function HeroCarousel({
  banners: heroBanners,
}: {
  banners: HeroBanner[];
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const isMobile = useIsMobile();

  // One frame for the whole carousel, not one per slide: a box that changed
  // shape every eight seconds would shove the page down and up beneath it.
  // Square only when every slide has a square crop to fill it — a wide
  // artwork in a square box is mostly blurred bar.
  const everySlideHasMobileCrop = heroBanners.every((b) =>
    Boolean(b.mobileImage),
  );
  const mobileAspect = everySlideHasMobileCrop ? "aspect-square" : "aspect-4/3";

  // The frame is now the full width of the window, and its proportions change
  // with it once max-h starts clamping the height, so whether a given slide
  // can be cropped to fill is not a fact that can be written into a class —
  // it is measured, here and on every resize, against each slide's own
  // proportions as the browser reports them on load.
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameRatio, setFrameRatio] = useState<number | null>(null);
  const [artRatio, setArtRatio] = useState<Record<string, number>>({});

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth && el.clientHeight)
        setFrameRatio(el.clientWidth / el.clientHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function noteArt(slug: string, img: HTMLImageElement) {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    setArtRatio((prev) =>
      prev[slug] === ratio ? prev : { ...prev, [slug]: ratio },
    );
  }

  // Defaults to showing the whole image: on well-matched artwork the two are
  // nearly indistinguishable, and being wrong this way leaves a hairline of
  // blur rather than a slide with its headline cut off.
  function fitFor(slug: string) {
    const art = artRatio[slug];
    if (!art || !frameRatio) return "object-contain";
    // Which edges get trimmed depends on which way round the mismatch is:
    // artwork squarer than the frame loses its top and bottom, artwork wider
    // than the frame loses its sides.
    const lost =
      art < frameRatio
        ? (frameRatio - art) / frameRatio
        : (art - frameRatio) / art;
    const limit =
      art < frameRatio ? CROP_LIMIT_VERTICAL : CROP_LIMIT_HORIZONTAL;
    return lost <= limit ? "object-cover" : "object-contain";
  }

  // Bumped whenever someone picks a slide, which restarts the countdown
  // below. Without it the interval kept its own schedule, so a slide chosen
  // by hand could be taken away again a moment later — worst exactly when
  // someone went back for a banner they had just watched go past.
  const [chosenAt, setChosenAt] = useState(0);

  useEffect(() => {
    if (paused || heroBanners.length === 0) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % heroBanners.length);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, heroBanners.length, chosenAt]);

  if (heroBanners.length === 0) return null;

  function showAt(i: number) {
    setIndex((i + heroBanners.length) % heroBanners.length);
    setChosenAt(Date.now());
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
    // Full width, no rounding and no card: the banner is the top of the page
    // rather than something sitting on it. Up to 1536px the frame is exactly
    // the wide crop's own 100:53, which is what smoothlife.com's own
    // slideshow does — measured there, 1153px across renders 1153x611 — so
    // every slide fills the width with nothing trimmed off it. Past that a
    // cap stops a very large monitor from opening on a thousand pixels of
    // banner and no shop.
    <div>
      <div
        ref={frameRef}
        className={`group relative w-full ${mobileAspect} md:aspect-100/53 2xl:max-h-[820px] overflow-hidden select-none touch-pan-y bg-surface-soft`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* All slides stacked + cross-faded, instead of hard-swapping — reads
          as a premium transition instead of a jump cut. */}
        {heroBanners.map((banner, i) => {
          const scene3D = hero3DSceneFor(banner.image);
          return (
            <Link
              key={banner.slug}
              href={banner.href}
              aria-hidden={i !== index}
              tabIndex={i === index ? 0 : -1}
              className="absolute inset-0 transition-opacity duration-700 ease-out"
              style={{
                opacity: i === index ? 1 : 0,
                pointerEvents: i === index ? "auto" : "none",
              }}
            >
              {/* The banner's own colours, blurred, behind it — what fills the
              frame for any slide the frame cannot crop to fit (see fitFor).
              It changes with the slide because each slide carries its own.

              Deliberately fetched small. It is going to be blurred beyond
              recognition, so a thumbnail's worth of pixels is plenty and the
              page does not download every banner twice at full size. */}
              <Image
                src={
                  isMobile ? (banner.mobileImage ?? banner.image) : banner.image
                }
                alt=""
                aria-hidden
                fill
                sizes="64px"
                className="scale-110 object-cover blur-2xl"
              />
              <Image
                src={
                  isMobile ? (banner.mobileImage ?? banner.image) : banner.image
                }
                alt={banner.title ?? ""}
                fill
                priority={i === 0}
                sizes="100vw"
                onLoad={(e) => noteArt(banner.slug, e.currentTarget)}
                className={fitFor(banner.slug)}
              />
              {/* A campaign whose artwork has also been supplied as its separate
              layers is rebuilt here with depth between them. Desktop only: it
              is a pointer-led effect, it costs a megabyte, and the phone crop
              is a different picture that has no layers. The flat banner above
              stays exactly where it is and shows through until the scene has
              loaded — or for good, on a machine with no WebGL. */}
              {isMobile === false && scene3D && (
                <HeroScene3D scene={scene3D} active={i === index} />
              )}
            </Link>
          );
        })}

        {heroBanners.length > 1 && (
          <>
            {/* Always visible on desktop now rather than on hover: at this size
              the arrows are the only sign there is more than one slide until
              it changes by itself. */}
            <button
              onClick={() => showAt(index - 1)}
              aria-label="ก่อนหน้า"
              className="hidden md:grid absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 place-items-center rounded-full bg-white/70 backdrop-blur-sm hover:bg-white text-brand-ink shadow-card transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => showAt(index + 1)}
              aria-label="ถัดไป"
              className="hidden md:grid absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 place-items-center rounded-full bg-white/70 backdrop-blur-sm hover:bg-white text-brand-ink shadow-card transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {/* Pagination stays under the frame rather than on it. Overlaid at the
          foot of the banner it landed squarely on the campaign's own date and
          venue, which is the one line on the artwork a customer is there to
          read — measured on a phone, where the square crop puts that line
          right where the dots want to be. On the page below it obscures
          nothing and can take its colours from the page. */}
      {heroBanners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3">
          {heroBanners.map((b, i) => (
            <button
              key={b.slug}
              onClick={() => showAt(i)}
              aria-label={`ไปที่แบนเนอร์ ${i + 1}`}
              className="relative h-1.5 w-5 overflow-hidden rounded-full bg-slate-200"
            >
              {i === index && (
                <span
                  key={`${b.slug}-${paused}`}
                  className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient"
                  style={{
                    animation: paused
                      ? "none"
                      : `heroFill ${AUTO_ROTATE_MS}ms linear forwards`,
                    width: paused ? "100%" : undefined,
                  }}
                />
              )}
              {i < index && (
                <span className="absolute inset-0 rounded-full bg-brand-gradient" />
              )}
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
