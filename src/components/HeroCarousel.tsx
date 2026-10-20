"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useInView, useTabVisible } from "@/lib/use-in-view";
import { HeroBanner } from "@/data/heroBanners";
import { hero3DSceneFor } from "@/data/hero-3d";
import { shopifyImage, shopifySrcSet } from "@/lib/shopify-image";

// The blurred plate behind a banner is scaled up and blurred past
// recognition, so it only ever needs a thumbnail. It was being fetched at the
// banner's own width — the same 434 KB file as the artwork in front of it,
// which the comment below already said it should not be.
const BLUR_WIDTH = 64;

// A phone never needs more than its own screen, at 2x. The desktop widths are
// the default in shopifySrcSet.
const MOBILE_WIDTHS = [480, 640, 828, 1080];

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

// Where each slide sits on a phone, as a coverflow: the campaign in the
// middle at full size with the one before and the one after peeking in from
// the edges. A full-bleed slide that changed by itself gave no sign there was
// anything either side of it until it had already gone; a card with its
// neighbours showing says how many there are and which way they run, and it
// is the same language the social clips further down the page speak.
//
// x is a percentage of the card's own width, so the whole thing scales with
// the screen. 90% puts a neighbour's inner edge exactly where the middle
// card's outer edge is, which leaves about 55px of it showing on a 375px
// phone — enough to read as a card, not enough to compete.
function coverflow(i: number, index: number, count: number) {
  let d = i - index;
  if (d > count / 2) d -= count;
  if (d < -count / 2) d += count;
  const side = Math.sign(d);
  const dist = Math.abs(d);
  if (dist === 0) return { x: 0, scale: 1, z: 30, opacity: 1 };
  if (dist === 1) return { x: side * 90, scale: 0.86, z: 20, opacity: 0.6 };
  // Everything further out is parked off to its side and invisible, so a
  // slide arrives from the direction it is coming from rather than fading up
  // in place.
  return { x: side * 150, scale: 0.76, z: 10, opacity: 0 };
}

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
  // Stopped on purpose, and stays stopped: hover is not a control a thumb
  // or a keyboard has (WCAG 2.2.2).
  const [userStopped, setUserStopped] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // A carousel turning off screen, or in a tab nobody is looking at, is a
  // timer and a repaint for nothing.
  const inView = useInView(rootRef);
  const tabVisible = useTabVisible();
  const running = !paused && !userStopped && inView && tabVisible;
  const touchStartX = useRef<number | null>(null);
  const isMobile = useIsMobile();

  // One frame for the whole carousel, not one per slide: a box that changed
  // shape every eight seconds would shove the page down and up beneath it.
  // Square only when every slide has a square crop to fill it — a wide
  // artwork in a square box is mostly blurred bar.
  const everySlideHasMobileCrop = heroBanners.every((b) =>
    Boolean(b.mobileImage),
  );
  // On a phone the card is 70% of the stage, so the stage has to be taller
  // than the card is wide by exactly that much — 10/7 of a square card,
  // 40/21 of a 4:3 one.
  //
  // "Exactly" was the problem: at those ratios the card's top and bottom sat
  // flush on the stage's own edges, and the stage clips, so the card's
  // outline was shaved off along both and its shadow with it. The stage is
  // now about 6.5% of the page width taller than the card — roughly 13px on
  // a 392px phone, and it scales with the screen rather than being a
  // constant that only looks right on one — which leaves the card a visible
  // edge above and below, the same as it has always had at its sides.
  const mobileCardAspect = everySlideHasMobileCrop ? "aspect-square" : "aspect-4/3";
  const mobileAspect = everySlideHasMobileCrop ? "aspect-[10/7.65]" : "aspect-[40/23.6]";

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
    if (!running || heroBanners.length === 0) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % heroBanners.length);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [running, heroBanners.length, chosenAt]);

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
    // isolate: the slides carry z-indexes of their own for the coverflow,
    // and without a stacking context here they compete with the rest of the
    // page — the hero band's search results opened underneath them.
    <div ref={rootRef} className="isolate">
      <div
        ref={frameRef}
        // The frame's own colour from md up only. It is there for a slide
        // that cannot be cropped to fill the box, where it shows as a
        // letterbox — but the phone layout is a coverflow whose cards cover
        // 70% of the frame, so down there it was simply a grey band around
        // them.
        // overflow-x-clip, not overflow-hidden: the slides either side are
        // parked far outside the stage horizontally and have to be cut off,
        // but hiding one axis makes the browser clip the other too, and what
        // hangs over the top and bottom here is the card's own soft shadow.
        // `clip` on one axis leaves the other genuinely visible.
        className={`group relative w-full ${mobileAspect} md:aspect-100/53 2xl:max-h-[820px] overflow-x-clip select-none touch-pan-y md:bg-surface-soft`}
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
              // A banner with no title leaves both its images with an empty
              // alt — correct, they are the same picture twice — and then the
              // link wrapping them has nothing to be announced as. A screen
              // reader reaches the shop's biggest call to action and can only
              // say "link".
              aria-label={banner.title ?? "ดูรายละเอียดแคมเปญ"}
              aria-hidden={i !== index}
              tabIndex={i === index ? 0 : -1}
              // bg: what the card is while the artwork is still arriving.
              // It was white, so on a phone the first thing the page showed
              // was an empty frame the size of the banner — the brightest
              // thing on screen, in the place the shop puts its campaign.
              // A soft tint reads as part of the design instead, and is
              // covered completely the moment the image paints.
              className={`hero-slide ${mobileCardAspect} md:aspect-auto overflow-hidden rounded-2xl bg-surface-mist md:rounded-none md:bg-transparent`}
              style={
                {
                  "--x": `${coverflow(i, index, heroBanners.length).x}%`,
                  "--s": coverflow(i, index, heroBanners.length).scale,
                  "--z": coverflow(i, index, heroBanners.length).z,
                  "--o": coverflow(i, index, heroBanners.length).opacity,
                  "--fade": i === index ? 1 : 0,
                  pointerEvents: i === index ? "auto" : "none",
                } as React.CSSProperties
              }
            >
              {/* The banner's own colours, blurred, behind it — what fills the
              frame for any slide the frame cannot crop to fit (see fitFor).
              It changes with the slide because each slide carries its own.

              Deliberately fetched small. It is going to be blurred beyond
              recognition, so a thumbnail's worth of pixels is plenty and the
              page does not download every banner twice at full size. */}
              {/* <picture> rather than <Image>, so the browser chooses the
              crop from the media query before any JavaScript runs. With
              <Image> the choice waited for hydration (isMobile starts null),
              so every phone first preloaded the 2000px desktop artwork
              (~370 KB) as its "priority" image and then downloaded the phone
              crop on top. The site runs with images.unoptimized, so <Image>
              was adding nothing here but that preload. */}
              <picture className="absolute inset-0 block">
                {banner.mobileImage && (
                  <source media={MOBILE_QUERY} srcSet={shopifyImage(banner.mobileImage, BLUR_WIDTH)} />
                )}
                { }
                <img
                  src={shopifyImage(banner.image, BLUR_WIDTH)}
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
                />
              </picture>
              <picture className="absolute inset-0 block">
                {banner.mobileImage && (
                  <source
                    media={MOBILE_QUERY}
                    srcSet={shopifySrcSet(banner.mobileImage, MOBILE_WIDTHS) ?? banner.mobileImage}
                    sizes="100vw"
                  />
                )}
                { }
                <img
                  src={banner.image}
                  srcSet={shopifySrcSet(banner.image)}
                  sizes="100vw"
                  alt={banner.title ?? ""}
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                  decoding="async"
                  onLoad={(e) => noteArt(banner.slug, e.currentTarget)}
                  // A cached image can finish before React attaches onLoad
                  // during hydration; read it on mount too.
                  ref={(el) => {
                    if (el?.complete) noteArt(banner.slug, el);
                  }}
                  className={`absolute inset-0 h-full w-full ${fitFor(banner.slug)}`}
                />
              </picture>
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
        // The dot you see is 20x6; the button around it is 44 tall, because
        // a thumb cannot be asked to find six pixels. The padding is on the
        // button rather than on the row, which is where it was before — a
        // row's padding makes the row taller and the target no bigger.
        <div className="flex items-center justify-center gap-0.5">
          {/* The one control that works without a pointer. */}
          <button
            type="button"
            onClick={() => setUserStopped((v) => !v)}
            aria-label={userStopped ? "เล่นสไลด์อัตโนมัติต่อ" : "หยุดสไลด์อัตโนมัติ"}
            className="grid h-11 w-8 place-items-center text-slate-400 transition-colors hover:text-brand-800"
          >
            {userStopped ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
          </button>
          {heroBanners.map((b, i) => (
            <button
              key={b.slug}
              onClick={() => showAt(i)}
              aria-label={`ไปที่แบนเนอร์ ${i + 1}`}
              className="grid h-11 w-6 place-items-center"
            >
              <span className="relative block h-1.5 w-5 overflow-hidden rounded-full bg-slate-200">
                {i === index && (
                  <span
                    key={`${b.slug}-${running}`}
                    className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient"
                    style={{
                      animation: running
                        ? `heroFill ${AUTO_ROTATE_MS}ms linear forwards`
                        : "none",
                      width: running ? undefined : "100%",
                    }}
                  />
                )}
                {i < index && (
                  <span className="absolute inset-0 rounded-full bg-brand-gradient" />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
