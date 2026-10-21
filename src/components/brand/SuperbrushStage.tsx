"use client";

import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTHB } from "@/lib/format";
import { script } from "@/components/janeke/font";

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

/** How much of the window's *height* the dome takes. Filling it to the last
 *  pixel reads as cramped, so this is the knob to turn when the dome looks too
 *  big or too small. It does not touch the width: where the screen runs out of
 *  width first — a tablet held upright — there is height to spare already, and
 *  trimming the dome there buys nothing and only costs it. */
const DOME_FILL = 0.92;

/** On a phone the controls sit under the arc rather than inside it. Their
 *  height is taken as a constant rather than measured, because measuring it
 *  would resize the dome every time a product with a longer blurb came round.
 *  56px is the tab bar the phone pins to the bottom of the window. */
const PHONE_CONTROLS = 220;
const PHONE_FOOT = 56;

/** How much of the dome's height the controls hang back into, on the negative
 *  margin they are given below. Flow height is that much shorter than the
 *  dome looks, which is why the two have to be counted together. */
const CTRL_OVERLAP = 0.17;

/** The pinned block's own foot — `pb-16` — which nothing else may stand in. */
const STAGE_FOOT = 64;

/**
 * The flattest the arc may be drawn.
 *
 * The arc's height is its width over this ratio, so a flatter one is a wider
 * one for the same height — which is the whole trade on a short window. 1.8
 * is the shape it is drawn at; past about 2.6 it stops reading as a dome and
 * starts reading as a horizon.
 */
const MAX_RATIO = 2.6;

/** What the controls need above md, taken as a constant for the same reason
 *  the phone's are: measured, it feeds back. The controls are capped at a
 *  share of the dome's width, so a dome the measurement shrinks is a row that
 *  wraps, which is taller, which shrinks the dome again — on a 1280×700
 *  window that ran all the way down to a dome of nothing. */
const WIDE_CONTROLS = 104;

export default function SuperbrushStage({ models, headline, intro }: Props) {
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
  /** The arc's ratio once the height budget has had its say — see MAX_RATIO. */
  const [domeRatio, setDomeRatio] = useState<number | null>(null);
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
        // The arc is a half circle here, so its height is its width, and the
        // controls claw back 16% of it on a negative margin. Everything else
        // is what the headline, the controls and the tab bar need; the rest is
        // the dome's. A flat 350px guess here is what left the headline flush
        // against the shop's header on a short phone.
        const room = avail - (head.current?.offsetHeight ?? HEADLINE) - PHONE_CONTROLS - PHONE_FOOT;
        const fit = Math.min(w, room / 0.84);
        setDomeSm(fit >= w ? null : fit);
        // Past half the screen the comb is still worth shopping from; below
        // that the stage gives up pinning and simply scrolls instead.
        setPinned(fit >= w * 0.5);
        setDomeRatio(null);
        return;
      }

      setDomeSm(null);
      // The dome's ratio by width, matching --dome-r below. Above md the
      // controls stand inside the dome, so only the headline is paid for.
      // 1.3 on a tablet rather than 1.6: held upright the screen runs out of
      // width long before it runs out of height, and the flatter arc left a
      // band of white above and below. A taller arc spends that height.
      const drawn = w < 1024 ? 1.3 : 1.8;
      const byWidth = w < 1024 ? Math.min(w * 0.96, 1100) : w * 0.92;
      const headH = head.current?.offsetHeight ?? HEADLINE;
      // What is left for the dome once the headline, the controls and the
      // foot have been paid for — and the controls are paid in full, not just
      // for the part of them that hangs below the dome. Counting only the
      // dome and the headline is what let the composition run 38px past the
      // window on a 900px screen with a two-row shop header, where what it
      // ran past was the top of its own headline.
      const room = (avail - headH - WIDE_CONTROLS - STAGE_FOOT) / (1 - CTRL_OVERLAP);
      // Width is what the window has to spare and height is what it does not,
      // so the arc is allowed to flatten to spend the one it has: the ratio
      // that would reach full width, held between the shape it is drawn at
      // and the flattest it may be. Sized at a fixed 1.8 the same height
      // budget drew an arc barely half the screen wide, which on a 1440px
      // window is a stage standing in the middle of its own empty room.
      const ratio = Math.min(MAX_RATIO, Math.max(drawn, byWidth / Math.max(room, 1)));
      const fitted = Math.min(byWidth, room * ratio * DOME_FILL);
      // Sized to the height, it fits by construction. The floor is what the
      // dome may shrink to before standing still stops being worth it — a
      // third of the screen, not half: on a laptop window about 760px tall
      // the half-screen floor was missed by a hair, the stage gave up
      // pinning, went back to full width, and the comb and the controls
      // under it ended up below the fold on a page whose whole point is the
      // comb. A smaller arc that is all there beats a grand one that is not.
      const pin = fitted >= w * 0.32;
      setPinned(pin);
      // Unpinned, the dome is still the one that fits the window rather than
      // the full width it is drawn at: the stage is scrolling now, but it
      // opens at the top of the page and should be readable there.
      const domeW = fitted;
      setDomeRatio(ratio);
      setDomeMax(domeW);
      const domeH = domeW / ratio;
      const spare = avail - headH - domeH;
      setTop(spare < CTRL_OVERLAP * domeH - WIDE_CONTROLS);
    };
    read();
    window.addEventListener("resize", read);
    // The headline is measured, so the dome has to be worked out again every
    // time that measurement changes — not only when the window does. It
    // changes on its own twice: the page's script face arrives after the
    // first paint and is taller than the fallback, and the line rewraps at
    // widths the window never reports a resize for. Measured once on mount,
    // the dome was sized for a headline 29px shorter than the one that ended
    // up on screen, and the whole composition was clipped by that much.
    const grew = new ResizeObserver(read);
    if (head.current) grew.observe(head.current);
    return () => {
      window.removeEventListener("resize", read);
      grew.disconnect();
    };
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
      className={`relative ${pinned ? "h-[180vh] md:h-[200vh]" : ""}`}
    >
      <div
        style={
          {
            "--stage-top": `${headerH}px`,
            ...(domeSm ? { "--dome-w-sm": `${Math.round(domeSm)}px` } : {}),
            ...(domeMax ? { "--dome-max": `${Math.round(domeMax)}px` } : {}),
            ...(domeRatio ? { "--dome-fit-r": domeRatio.toFixed(3) } : {}),
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
        className={`[--dome-r:1] [--dome-w:var(--dome-w-sm,100vw)] [--dome-h:calc(var(--dome-w)/var(--dome-r))] md:flex md:flex-col md:[--dome-r:var(--dome-fit-r,1.3)] md:[--dome-w:min(96vw,1100px,var(--dome-max,1100px))] lg:[--dome-r:var(--dome-fit-r,1.8)] lg:[--dome-w:min(92vw,var(--dome-max,1360px))] ${
          pinned
            ? `sticky top-[var(--stage-top)] h-[calc(100vh-var(--stage-top))] overflow-hidden flex flex-col justify-start pb-14 md:pb-16 ${top ? "md:justify-start" : "md:justify-center"}`
            : ""
        }`}
      >
        <header ref={head} className="relative z-20 px-4 pb-2 pt-3 text-center md:pb-8 md:pt-4 lg:pb-12">
          {/* The script the landing page is set in, at the size its other
              headings use, so the stage reads as part of that page rather
              than as a component borrowed from somewhere else. */}
          <h1
            // Capped by the window's height as well as its width: on a short
            // laptop window the headline at 7vw took a fifth of everything
            // there was, and what it took came off the comb underneath it.
            className={`${script.className} text-[clamp(2.25rem,min(7vw,9vh),5rem)] leading-tight text-[#685048]`}
          >
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
                over it and the word reads as the surface the comb sits on.

                The share of the dome it takes grows with the screen. On a
                phone the dome is the whole width, so one ratio for every
                size put the word edge to edge with nothing either side;
                a desktop has the room for it to span. */}
            <p
              aria-hidden
              style={{
                transform: `translate3d(0, ${lift * -34}px, 0)`,
                color: `${darker(current.swatch[0], current.swatch[1])}33`,
              }}
              className={`absolute inset-x-0 top-[38%] [--mark:0.135] text-center text-[clamp(2rem,calc(var(--dome-w)*var(--mark)),13rem)] leading-none transition-colors duration-700 md:top-[42%] md:[--mark:0.155] lg:[--mark:0.163] ${script.className}`}
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
                      // Scrolling through the stage lifts the comb out of the
                      // arch, and that is all it does. It used to turn and
                      // grow as well; turning is what made the growth worth
                      // having, because lying down it is widest across where
                      // the dome has the most room, so both went together.
                      transform: `translate3d(0, ${lift * -70}px, 0)`,
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
                            "h-[calc(var(--dome-h)*0.66)] md:h-[calc(var(--dome-h)*0.7)] lg:h-[calc(var(--dome-h)*0.8)] drop-shadow-[0_26px_44px_rgba(15,23,42,0.22)]"
                          : "h-[calc(var(--dome-h)*0.56)] md:h-[calc(var(--dome-h)*0.62)] lg:h-[calc(var(--dome-h)*0.72)] rounded-[2rem] bg-white/70 shadow-[0_30px_60px_rgba(15,23,42,0.18)] ring-1 ring-white/70"
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
        <div ref={ctrl} className="relative z-20 mx-auto -mt-[calc(var(--dome-h)*0.16)] flex w-full max-w-[1180px] flex-col items-center gap-3 px-4 pb-8 md:pb-4 md:-mt-[calc(var(--dome-h)*0.17)] md:max-w-[min(1180px,max(calc(var(--dome-w)*0.9),46rem))] md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex flex-wrap items-center justify-center gap-1 rounded-full bg-white/90 p-1 shadow-[0_6px_18px_rgba(15,23,42,0.08)] md:max-w-[calc(50%-5rem)] md:flex-nowrap md:gap-0.5 lg:gap-1">
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

          {/* The model, then what it is, then what it costs — the order the
              design puts them in. The heading is the model rather than the
              product: the slide is a range of colours, and which colour is
              on it is said by the swatch with the tick on it and again
              beside the price. */}
          <div className="text-center md:max-w-[min(22rem,calc(50%-5rem))] md:text-left">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-brand-ink">
              {model.title}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{model.blurb}</p>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 md:justify-start">
              <span className="text-sm font-bold text-brand-ink">{formatTHB(current.price)}</span>
              <span className="text-xs text-slate-500">{current.colour}</span>
              <Link
                href={`/product/${current.slug}`}
                className="rounded-full bg-brand-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                {current.soldOut ? "ดูรายละเอียด" : "ซื้อเลย"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
