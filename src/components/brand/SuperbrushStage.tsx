"use client";

import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
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
  /** The product's full name from the catalogue, which is what the shop sells
   *  it as — "Small ฟ้าพาสเทล" was a label this component made up. */
  name: string;
  /** The colour's own name, as the shop sells it — "Pink Pastel". */
  colour: string;
  /** Two stops, because these combs are two-tone: handle and pad. */
  swatch: [string, string];
  /** The two stops of the wash behind the comb: the grid's colour and the
   *  handle's, which is how the design fills the arc. */
  tint: string;
  tint2: string;
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

/** The darker of a comb's two colours. The watermark behind it is drawn in
 *  this one: on a gold comb the handle is paler than the dome it sits on, so
 *  taking the first stop blindly made the word disappear. */
function darker(a: string, b: string) {
  const lum = (hex: string) => {
    const n = hex.replace("#", "");
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  return lum(a) <= lum(b) ? a : b;
}

/** Index into the flat list, so a drag can cross a model boundary. */
type Flat = { model: number; item: number };

/** What the headline above the dome needs before it has been measured. The
 *  dome takes whatever the window has left, so a guess here is a dome that
 *  overruns the fold by however far the guess was out — it is measured on
 *  mount and this only covers the first paint. */
const HEADLINE = 150;

/** How much of what the window allows the dome actually takes. Filling it to
 *  the last pixel reads as cramped — the arc wants air around it — so this is
 *  the one knob to turn when the dome looks too big or too small. */
const DOME_FILL = 0.92;

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
  // On a phone the dome runs edge to edge, but a short screen cannot hold a
  // full-width arc plus the headline and the controls. Shrinking it keeps the
  // stage usable there; the arc keeps its ratio, so it only gets smaller,
  // never flatter. Null means it stays full-bleed.
  const [domeSm, setDomeSm] = useState<number | null>(null);
  // The widest the dome may be from md up. It used to be a flat 1360px, which
  // on a screen wider than that left white down both sides and slack above and
  // below. Now it fills the width and only gives way to the height the screen
  // actually has, so the composition sits in the window rather than inside it.
  const [domeMax, setDomeMax] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLElement>(null);
  const ctrl = useRef<HTMLDivElement>(null);
  // Where the composition sits in a window taller than it needs. Pinned to the
  // top when the dome is as tall as the window allows — centring would then
  // push its foot past the fold, because the controls hang back up into the
  // dome on a negative margin and the flow is shorter than what you see.
  // Centred when the dome ran out of width first and the leftover is real.
  const [top, setTop] = useState(false);
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
      const avail = window.innerHeight - h;

      if (w < 768) {
        // The arc is a half circle here, so its height is its width. 330px is
        // what the headline above it and the controls under it need, plus a
        // gap so the headline never lands flush against the header; whatever
        // is left over is how wide the dome may be.
        const fit = Math.min(w, avail - 350);
        setDomeSm(fit >= w ? null : fit);
        // Under 60% of the screen the comb would be too small to shop from,
        // so the stage gives up pinning and simply scrolls instead.
        setPinned(fit >= w * 0.6);
        return;
      }

      setDomeSm(null);
      // The dome's ratio by width, matching --dome-r below. Above md the
      // controls stand inside the dome, so only the headline is paid for.
      const ratio = w < 1024 ? 1.6 : 1.8;
      const byWidth = w < 1024 ? Math.min(w * 0.96, 1100) : w * 0.92;
      const byHeight = (avail - (head.current?.offsetHeight ?? HEADLINE)) * ratio;
      const domeW = Math.min(byWidth, byHeight) * DOME_FILL;
      setDomeMax(domeW);
      const domeH = domeW / ratio;
      const spare = avail - (head.current?.offsetHeight ?? HEADLINE) - domeH;
      setTop(spare < 0.17 * domeH - (ctrl.current?.offsetHeight ?? 100));
      // Sized to the height, it fits by construction — unless the window is so
      // short that filling it would leave the dome smaller than the screen it
      // stands on, which reads as a stamp rather than a stage.
      setPinned(domeW >= w * 0.6);
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
      className={`relative pt-2 md:pt-0 ${pinned ? "h-[180vh] md:h-[200vh]" : ""}`}
    >
      <div
        style={
          {
            "--stage-top": `${headerH}px`,
            ...(domeSm ? { "--dome-w-sm": `${Math.round(domeSm)}px` } : {}),
            ...(domeMax ? { "--dome-max": `${Math.round(domeMax)}px` } : {}),
          } as React.CSSProperties
        }
        // --dome-r is the arc's ratio and --dome-h its height, taken straight
        // from the full width so the dome is always edge to edge and always
        // the same arc.
        //
        // Pinning it to the screen is what has a height budget, not the dome:
        // on a window too short to hold the headline, the dome and the
        // controls at once, the stage stops being sticky and simply scrolls —
        // better than a pinned block whose bottom row cannot be reached.
        className={`[--dome-r:1] [--dome-w:var(--dome-w-sm,100vw)] [--dome-h:calc(var(--dome-w)/var(--dome-r))] md:flex md:flex-col md:[--dome-r:1.6] md:[--dome-w:min(96vw,1100px,var(--dome-max,1100px))] lg:[--dome-r:1.8] lg:[--dome-w:min(92vw,var(--dome-max,1360px))] ${
          pinned
            ? `sticky top-[var(--stage-top)] h-[calc(100vh-var(--stage-top))] overflow-hidden flex flex-col justify-center pb-20 md:pb-0 ${top ? "md:justify-start" : "md:justify-center"}`
            : ""
        }`}
      >
        <header ref={head} className="relative z-20 px-4 pb-2 pt-6 text-center md:pb-8 md:pt-6 lg:pb-12">
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
          className="relative mt-4 flex touch-pan-y select-none flex-col justify-end outline-hidden md:mt-0"
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
              backgroundImage: [
                // The crown's light, over the two colours of the comb.
                "radial-gradient(90% 62% at 50% -4%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 62%)",
                `linear-gradient(100deg, ${current.tint} 0%, ${current.tint} 32%, ${current.tint2} 68%, ${deepen(current.tint2)} 100%)`,
              ].join(", "),
            }}
            className="absolute inset-x-0 bottom-0 mx-auto h-[var(--dome-h)] w-[var(--dome-w)] overflow-hidden rounded-t-full transition-colors duration-700"
          >
            {/* Flat, the way it is drawn: the dome is one colour and the cloud
                bank is what takes it to white at the foot. A gradient to
                transparent made the whole thing look like a smudge. */}
            <span className="janeke-clouds-far inset-x-[-14%] bottom-[8%] h-[72%]" />
            <span className="janeke-clouds inset-x-[-14%] bottom-[-4%] h-[88%]" />
            <span className="absolute inset-x-0 bottom-0 h-[18%] bg-linear-to-t from-white to-transparent" />
          </div>
          <div className="relative mx-auto flex h-[var(--dome-h)] w-[var(--dome-w)] items-center justify-center">
            {/* The model's name set large and pale behind the comb, the way
                it was before it was tried as a heading at the crown. No z-index
                of its own: the combs come after it in the DOM, so they paint
                over it and the word reads as the surface the comb sits on. */}
            <p
              aria-hidden
              style={{
                transform: `translate3d(0, ${lift * -34}px, 0)`,
                color: `${darker(current.swatch[0], current.swatch[1])}33`,
              }}
              className="absolute inset-x-0 top-[40%] text-center font-serif text-[clamp(2rem,calc(var(--dome-w)*0.13),10rem)] italic leading-none transition-colors duration-700 md:top-[44%]"
            >
              {model.wordmark}
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
                      // Scrolling through the stage lays the comb down and
                      // brings it closer: by the time the stage is leaving it
                      // has turned a quarter turn and grown by half again.
                      // Lying down it is widest across, where the dome has the
                      // most room, so the growth has somewhere to go.
                      transform: `translate3d(0, calc(${lift * -70}px - 3%), 0) rotate(${(lift * 35).toFixed(1)}deg) scale(${(1 + lift * 0.2).toFixed(3)})`,
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
                            "h-[calc(var(--dome-h)*0.58)] md:h-[calc(var(--dome-h)*0.62)] lg:h-[calc(var(--dome-h)*0.72)] drop-shadow-[0_26px_44px_rgba(15,23,42,0.22)]"
                          : "h-[calc(var(--dome-h)*0.5)] md:h-[calc(var(--dome-h)*0.56)] lg:h-[calc(var(--dome-h)*0.64)] rounded-[2rem] bg-white/70 shadow-[0_30px_60px_rgba(15,23,42,0.18)] ring-1 ring-white/70"
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
            with it at every size.

            The row spans the dome rather than a fixed 1180px, and spreads
            rather than centres: bunched in the middle of a wide screen the
            three groups read as one crowded blob with empty arc either side.
            At 16% of the way up the arc is still 98% of its full width, so
            90% of the dome keeps the row clear of the curve. `gap` is the
            floor the spread may not close past on a narrow screen. */}
        <div ref={ctrl} className="relative z-20 mx-auto -mt-[calc(var(--dome-h)*0.16)] flex w-full max-w-[1180px] flex-col items-center gap-3 px-4 pb-8 md:pb-4 md:-mt-[calc(var(--dome-h)*0.17)] md:max-w-[calc(var(--dome-w)*0.9)] md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex flex-wrap items-center justify-center gap-1 rounded-full bg-white/90 p-1 shadow-[0_6px_18px_rgba(15,23,42,0.08)] md:max-w-[calc(50%-6rem)] md:gap-0.5 lg:gap-1">
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
                  className={`grid size-7 place-items-center rounded-full transition-transform ${
                    on ? "ring-2 ring-brand-ink" : "hover:scale-105"
                  }`}
                  style={{ backgroundImage: `linear-gradient(135deg, ${c.swatch[0]} 0 50%, ${c.swatch[1]} 50% 100%)` }}
                >
                  {/* The tick the design puts on the chosen colour — a ring
                      alone is hard to spot against a two-tone circle. */}
                  {on && <Check size={14} strokeWidth={3} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" />}
                </button>
              );
            })}
          </div>

          {/* Centred on the dome, not on what justify-between leaves over:
              the swatch pill and the product block are not the same width, so
              in the flow the numbers sat off to whichever side had less. Out
              of the flow they land on the dome's axis at every width, and the
              two blocks either side still reach for the edges. */}
          <div className="flex items-center justify-center gap-2 md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
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

          <div className="text-center md:max-w-[min(22rem,calc(50%-6rem))] md:text-left">
            <p className="text-sm font-bold text-brand-ink">{current.name}</p>
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
