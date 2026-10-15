"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTHB } from "@/lib/format";

// The Janeke stage: one comb at a time, floating inside a tinted arch, with
// the model's name set huge behind it.
//
// Everything here is one slider over a flat list of colourways. The three
// controls are three ways into the same index, which is why they can never
// disagree with each other:
//
//   the dots      jump to the first colourway of a model
//   the swatches  move within the model you are on
//   a drag        moves one colourway, and runs off the end into the next model
//
// The stage is twice the height of the screen and the composition inside it is
// sticky, so the page keeps scrolling while the comb lifts and the wordmark
// drifts — the scroll is the animation, not a trigger for one. On a phone the
// extra height is dropped: a tall sticky stage on a small screen reads as a
// page that will not move.

export type Colourway = {
  slug: string;
  /** The colour's own name, as the shop sells it — "Pink Pastel". */
  colour: string;
  /** Two stops, because these combs are two-tone: handle and pad. */
  swatch: [string, string];
  /** The wash behind the comb when this colourway is showing. */
  tint: string;
  image: string;
  /** True when the photograph is masked and can sit on the arch unframed. */
  cutout: boolean;
  price: number;
  soldOut: boolean;
};

export type StageModel = {
  key: string;
  /** "Small", "Premium" — the label under the comb, with the colour. */
  title: string;
  /** Set huge behind the comb. The family name, not the model's: it is the
   *  word the range is known by, and it has to be long enough to fill the
   *  arch. */
  wordmark: string;
  /** The line under the name, bottom right. */
  blurb: string;
  items: Colourway[];
};

type Props = {
  models: StageModel[];
  headline: string;
  intro: string;
  /** Where "ดูทั้งหมด" goes — the brand's own shelf, further down the page. */
  allHref: string;
};

/** The dome is lit from its crown: white at the top, the colourway's tint
 *  through the middle, a shade of the same colour at the rim. One multiplier
 *  gives that last stop without a second colour to keep in step. */
function deepen(hex: string, factor = 0.9) {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const to = (v: number) => Math.max(0, Math.round(v * factor)).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Index into the flat list, so a drag can cross a model boundary. */
type Flat = { model: number; item: number };

export default function SuperbrushStage({ models, headline, intro, allHref }: Props) {
  const flat = useMemo<Flat[]>(
    () => models.flatMap((m, model) => m.items.map((_, item) => ({ model, item }))),
    [models],
  );
  const [pos, setPos] = useState(0);
  const [lift, setLift] = useState(0);
  // The shop's header is sticky and its height changes with the viewport (a
  // promo bar on a wide screen, two rows on a narrow one). A guessed offset is
  // how the headline ended up underneath it, so the stage measures it.
  const [headerH, setHeaderH] = useState(96);
  // Whether the stage can be pinned to the screen at all. A fixed media query
  // cannot answer this: the dome's height follows the window's *width*, so
  // 900px of height is enough at 1200px wide and 130px short at 1700px wide.
  const [pinned, setPinned] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);

  const here = flat[Math.min(pos, flat.length - 1)] ?? { model: 0, item: 0 };
  const model = models[here.model];
  const current = model?.items[here.item];

  const go = useCallback(
    (delta: number) => {
      if (!flat.length) return;
      setPos((p) => (p + delta + flat.length) % flat.length);
    },
    [flat.length],
  );

  /** Where a model starts in the flat list — what a dot jumps to. */
  const startOf = useCallback(
    (model: number) => flat.findIndex((f) => f.model === model),
    [flat],
  );

  useEffect(() => {
    const read = () => {
      const h = document.querySelector("header")?.offsetHeight ?? 96;
      setHeaderH(h);
      const w = window.innerWidth;
      // The dome's ratio by width, matching --dome-r below.
      const ratio = w < 768 ? 1 : w < 1024 ? 2.2 : 3;
      // 230px covers the headline above the dome and the controls under it.
      setPinned(w >= 768 && window.innerHeight - h >= w / ratio + 230);
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // How far the comb has lifted: 0 at the top of the stage, 1 when the stage
  // is leaving. Read off the scroll position rather than animated on a timer,
  // so it tracks a trackpad exactly and stops when the finger stops.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      if (travel <= 0) return setLift(0);
      setLift(Math.min(1, Math.max(0, -r.top / travel)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (!model || !current) return null;

  return (
    <section
      ref={stage}
      aria-roledescription="carousel"
      aria-label={`${headline} — เลือกสีและรุ่น`}
      className={`relative pt-2 md:pt-0 ${pinned ? "md:h-[200vh]" : ""}`}
    >
      <div
        style={{ "--stage-top": `${headerH}px` } as React.CSSProperties}
        // --dome-r is the arc's ratio and --dome-h its height, taken straight
        // from the full width so the dome is always edge to edge and always
        // the same arc.
        //
        // Pinning it to the screen is what has a height budget, not the dome:
        // on a window too short to hold the headline, the dome and the
        // controls at once, the stage stops being sticky and simply scrolls —
        // better than a pinned block whose bottom row cannot be reached.
        className={`[--dome-r:1] [--dome-h:calc(100vw/var(--dome-r))] md:flex md:flex-col md:justify-center md:[--dome-r:2.2] lg:[--dome-r:3] ${
          pinned
            ? "md:sticky md:top-[var(--stage-top)] md:h-[calc(100vh-var(--stage-top))] md:overflow-hidden"
            : ""
        }`}
      >
        <header className="relative z-20 px-4 pt-6 text-center md:pt-0">
          <h1 className="font-serif text-[clamp(2rem,6vw,4.25rem)] italic leading-[1.05] text-brand-ink">
            {headline}
          </h1>
          <p className="mt-2 text-sm text-slate-500 md:text-base">{intro}</p>
        </header>

        {/* The stage proper. The pointer handlers sit here rather than on the
            image: a drag that only works when it starts on the comb is a drag
            most people never find. */}
        <div
          role="group"
          tabIndex={0}
          aria-label="เลื่อนดูสีและรุ่น"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
            if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
          }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, moved: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.moved) return;
            const dx = e.clientX - d.x;
            // 56px: past a tap, short of a scroll gesture on a trackpad.
            if (Math.abs(dx) > 56) {
              d.moved = true;
              go(dx < 0 ? 1 : -1);
            }
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          className="relative mt-4 flex touch-pan-y select-none flex-col justify-end outline-hidden md:mt-0 md:flex-1"
        >
          {/* The arch, tinted by the colourway, with the cloud bank sitting
              inside it.
              The clouds are drawn rather than photographed: a photograph of a
              sky is one colour, and this arch is nine — white gradients sit on
              any of them, cost nothing to download, and do not have to be
              re-shot when a colour is added. */}
          {/* Full bleed, and the same arc whatever the window does: the dome's
              height comes from its width, not from the viewport's height, so
              resizing never restretches it into a flat hill or a steep tunnel.
              Three steps rather than one ratio, because a single ratio that
              suits a desktop leaves a phone with a 125px-tall dome and the comb
              floating above it — which is exactly what one ratio did. */}
          <div
            aria-hidden
            style={{
              backgroundImage: `radial-gradient(120% 98% at 50% -8%, #ffffff 0%, ${current.tint} 46%, ${deepen(current.tint)} 100%)`,
            }}
            className="absolute inset-x-0 bottom-0 mx-auto h-[var(--dome-h)] w-screen overflow-hidden rounded-t-full transition-colors duration-700"
          >
            {/* Flat, the way it is drawn: the dome is one colour and the cloud
                bank is what takes it to white at the foot. A gradient to
                transparent made the whole thing look like a smudge. */}
            <span className="janeke-clouds-far inset-x-[-14%] bottom-[8%] h-[72%]" />
            <span className="janeke-clouds inset-x-[-14%] bottom-[-4%] h-[88%]" />
            <span className="absolute inset-x-0 bottom-0 h-[18%] bg-linear-to-t from-white to-transparent" />
          </div>
          <div className="relative flex h-[var(--dome-h)] w-full items-center justify-center">
            {/* The model's name at the crown of the dome, in the shop's serif.
                It replaces the huge translucent wordmark that used to sit
                behind the comb: the comb covered most of it, and the design
                reads the name as a heading rather than as a watermark. */}
            <p
              aria-hidden
              style={{ transform: `translate3d(0, ${lift * -24}px, 0)` }}
              className="absolute inset-x-0 top-[7%] z-10 text-center font-serif text-[clamp(1.5rem,4.2vw,3.75rem)] leading-none text-brand-ink md:top-[9%]"
            >
              {model.title}
            </p>
            {models.flatMap((m) =>
              m.items.map((c) => {
                const on = c.slug === current.slug;
                return (
                  // Every colourway is in the DOM and only the current one is
                  // opaque: a crossfade between two <Image>s that are already
                  // decoded, instead of a white gap while the next one loads.
                  // Two elements, because two things move it: the wrapper
                  // carries the scroll (which the page drives) and the image
                  // carries the float (which runs on its own). One element
                  // cannot hold both — a CSS animation on transform overrides
                  // an inline transform outright, and the lift would be lost.
                  <span
                    key={c.slug}
                    style={{
                      transform: `translate3d(0, ${lift * -70}px, 0) scale(${1 - lift * 0.06})`,
                    }}
                    className={`absolute flex h-full w-full items-center justify-center transition-opacity duration-500 ${
                      on ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <Image
                      src={c.image}
                      alt={on ? `${m.title} ${c.colour}` : ""}
                      aria-hidden={!on}
                      width={520}
                      height={520}
                      // preload, not priority: priority is deprecated in Next 16.
                      preload={c.slug === models[0]?.items[0]?.slug}
                      className={`janeke-float w-auto object-contain ${
                        c.cutout
                          ? // About 60% of the stage, as drawn: the dome is most
                            // of what you see and the comb sits in it, rather
                            // than filling it.
                            "h-[calc(var(--dome-h)*0.52)] md:h-[calc(var(--dome-h)*0.68)] drop-shadow-[0_26px_44px_rgba(15,23,42,0.22)]"
                          : "h-[calc(var(--dome-h)*0.46)] md:h-[calc(var(--dome-h)*0.6)] rounded-[2rem] bg-white/70 shadow-[0_30px_60px_rgba(15,23,42,0.18)] ring-1 ring-white/70"
                      }`}
                    />
                  </span>
                );
              }),
            )}
          </div>
        </div>

        {/* Controls — swatches, dots, then the product, in one row standing on
            the cloud bank at the foot of the dome, which is where the design
            puts them. Lifted by a share of the dome's own height so they stay
            with it at every size. */}
        <div className="relative z-20 mx-auto -mt-[calc(var(--dome-h)*0.16)] flex w-full max-w-[1180px] flex-col items-center gap-3 px-4 pb-8 md:-mt-[calc(var(--dome-h)*0.14)] md:flex-row md:items-center md:justify-center md:gap-10">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {model.items.map((c, i) => {
              const on = i === here.item;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setPos(startOf(here.model) + i)}
                  title={c.colour}
                  aria-label={`สี ${c.colour}`}
                  aria-pressed={on}
                  className={`size-7 rounded-full ring-2 transition-transform ${
                    on ? "scale-110 ring-brand-ink" : "ring-white hover:scale-105"
                  }`}
                  style={{ backgroundImage: `linear-gradient(135deg, ${c.swatch[0]} 0 50%, ${c.swatch[1]} 50% 100%)` }}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2">
            {models.map((m, i) => {
              const on = i === here.model;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPos(startOf(i))}
                  aria-label={m.title}
                  aria-current={on}
                  className={`grid size-9 place-items-center rounded-full text-xs font-semibold transition-colors ${
                    on
                      ? "bg-brand-ink text-white"
                      : "border border-slate-300 text-slate-600 hover:border-brand-ink hover:text-brand-ink"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="text-center md:max-w-[22rem] md:text-left">
            <p className="text-sm font-bold uppercase tracking-wide text-brand-ink">
              {model.title} {current.colour}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{model.blurb}</p>
            <div className="mt-2 flex items-center justify-center gap-3 md:justify-start">
              <span className="text-sm font-bold text-brand-ink">{formatTHB(current.price)}</span>
              <Link
                href={`/product/${current.slug}`}
                className="rounded-full bg-brand-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                {current.soldOut ? "ดูรายละเอียด" : "ซื้อเลย"}
              </Link>
              <Link href={allHref} className="text-xs font-semibold text-slate-500 hover:text-brand-ink">
                ดูทั้งหมด
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
