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

/** Index into the flat list, so a drag can cross a model boundary. */
type Flat = { model: number; item: number };

export default function SuperbrushStage({ models, headline, intro, allHref }: Props) {
  const flat = useMemo<Flat[]>(
    () => models.flatMap((m, model) => m.items.map((_, item) => ({ model, item }))),
    [models],
  );
  const [pos, setPos] = useState(0);
  const [lift, setLift] = useState(0);
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
      className="relative -mt-6 pt-2 md:-mt-10 md:h-[200vh] md:pt-0"
    >
      <div className="md:sticky md:top-16 md:flex md:h-[calc(100vh-4rem)] md:flex-col md:justify-center md:overflow-hidden">
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
          className="relative mt-4 touch-pan-y select-none outline-hidden md:mt-0 md:flex-1"
        >
          {/* The arch, tinted by the colourway, with the cloud bank sitting
              inside it.
              The clouds are drawn rather than photographed: a photograph of a
              sky is one colour, and this arch is nine — white gradients sit on
              any of them, cost nothing to download, and do not have to be
              re-shot when a colour is added. */}
          <div
            aria-hidden
            style={{
              backgroundImage: `linear-gradient(to bottom, ${current.tint} 0%, ${current.tint} 38%, ${current.tint}00 92%)`,
            }}
            className="absolute inset-x-0 bottom-0 mx-auto h-[62vh] w-[min(96vw,1180px)] overflow-hidden rounded-t-full transition-[background-image] duration-700 md:h-[70vh]"
          >
            <span className="janeke-clouds absolute inset-x-[-14%] bottom-[-4%] h-[78%]" />
          </div>
          {/* The model's name, behind everything, drifting as the page moves. */}
          <p
            aria-hidden
            style={{
              transform: `translate3d(0, ${lift * -40}px, 0)`,
              color: `${current.swatch[0]}2e`,
            }}
            className="absolute inset-x-0 bottom-[20%] text-center font-serif text-[clamp(3rem,14vw,11rem)] italic leading-none transition-colors duration-700 md:bottom-[24%]"
          >
            {model.wordmark}
          </p>

          <div className="relative flex h-[46vh] items-center justify-center md:h-full">
            {models.flatMap((m) =>
              m.items.map((c) => {
                const on = c.slug === current.slug;
                return (
                  // Every colourway is in the DOM and only the current one is
                  // opaque: a crossfade between two <Image>s that are already
                  // decoded, instead of a white gap while the next one loads.
                  <Image
                    key={c.slug}
                    src={c.image}
                    alt={on ? `${m.title} ${c.colour}` : ""}
                    aria-hidden={!on}
                    width={520}
                    height={520}
                    // preload, not priority: priority is deprecated in Next 16.
                    preload={c.slug === models[0]?.items[0]?.slug}
                    style={{
                      transform: `translate3d(0, ${lift * -70}px, 0) scale(${1 - lift * 0.06})`,
                    }}
                    className={`absolute w-auto object-contain transition-opacity duration-500 ${
                      c.cutout
                        ? "h-[82%] drop-shadow-[0_26px_44px_rgba(15,23,42,0.22)]"
                        : "h-[68%] rounded-[2rem] bg-white/70 shadow-[0_30px_60px_rgba(15,23,42,0.18)] ring-1 ring-white/70"
                    } ${on ? "opacity-100" : "opacity-0"}`}
                  />
                );
              }),
            )}
          </div>
        </div>

        {/* Controls — swatches left, dots centre, the product right, as drawn. */}
        <div className="relative z-20 mx-auto grid w-full max-w-[1180px] gap-5 px-4 pb-10 md:grid-cols-[1fr_auto_1fr] md:items-end md:gap-6">
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
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

          <div className="text-center md:text-right">
            <p className="text-sm font-bold uppercase tracking-wide text-brand-ink">
              {model.title} {current.colour}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{model.blurb}</p>
            <div className="mt-2 flex items-center justify-center gap-3 md:justify-end">
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
