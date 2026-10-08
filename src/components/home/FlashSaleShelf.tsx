"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCollectionByHandle, getCollectionProducts } from "@/data/collections";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import FlashSaleCard from "@/components/home/FlashSaleCard";

// The flash sale band: the campaign on the left, what is on sale on the right.
//
// It replaces a plain banner-above-a-shelf, and the reason is the clock. A
// campaign that ends is not a picture of a campaign — the countdown, the
// lockup and the mascot are the left third of the band in the design because
// they are what makes the row beside them urgent. As a separate strip above,
// which is what the banner was, the two halves could not refer to each other.
//
// Everything comes from the widget the admin edits: the deadline, the
// collection, where "ดูทั้งหมด" leads. With no deadline set the band still
// works — it is then a shelf with a lockup, which is what a campaign with no
// end date actually is.

const SHOWN = 10;

/** Supplied by the designer. The band falls back to drawn type and no mascot
 *  when they are not on disk, so a missing file costs it artwork rather than
 *  taking the products down with it. */
const LOCKUP_SRC = "/flash-sale/lockup.png";
const MASCOT_SRC = "/flash-sale/mascot.png";

type Parts = { h: number; m: number; s: number };

function remaining(endsAt: string): Parts | null {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  // Hours, not days-and-hours: the design has three boxes, and "71h" is a
  // truer thing to put in front of someone in a hurry than "2d".
  return { h: Math.floor(total / 3600), m: Math.floor(total / 60) % 60, s: total % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** One of the three clock boxes. The hairline across the middle is what makes
 *  it read as a flip clock rather than as a dark chip. */
function Box({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative grid h-11 min-w-[52px] place-items-center rounded-lg bg-[#2b2b2b] px-2 text-xl font-extrabold tabular-nums text-white shadow-[0_6px_14px_rgba(0,0,0,0.35)] md:h-14 md:min-w-[72px] md:text-3xl">
      {children}
      <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-black/35" />
    </span>
  );
}

export default function FlashSaleShelf() {
  const { settings, loaded } = useWidgetSettings();
  // A plain ref, not useRailFade: the band wanted the fade removed, and the
  // hook's only other job here was holding this.
  const railRef = useRef<HTMLUListElement>(null);
  const widget = settings.flash_sale_shelf;
  const cfg = widget.config as {
    href?: string;
    collection?: string;
    titleTh?: string;
    endsAt?: string;
  };

  // null = not counted yet, undefined = the deadline has passed.
  const [left, setLeft] = useState<Parts | null | undefined>(null);
  const [art, setArt] = useState({ lockup: true, mascot: true });

  useEffect(() => {
    if (!cfg.endsAt) return;
    const tick = () => setLeft(remaining(cfg.endsAt!) ?? undefined);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cfg.endsAt]);

  const collection = cfg.collection ? getCollectionByHandle(cfg.collection) : undefined;
  const shelf = collection
    ? getCollectionProducts(collection)
        .filter((p) => p.inStock && p.image)
        .slice(0, SHOWN)
    : [];

  if (!loaded || !widget.enabled) return null;
  // A flash sale band with nothing in it is an advert for an empty shelf.
  if (shelf.length === 0) return null;

  const href = cfg.href || (cfg.collection ? `/collections/${cfg.collection}` : "/promotions");
  const title = cfg.titleTh || collection?.title || "Flash Sale";
  const expired = Boolean(cfg.endsAt) && left === undefined;

  return (
    <section className="py-6 md:py-8">
      <div className="mx-auto max-w-[1512px] px-4 md:px-6">
        <div
          className="relative overflow-hidden rounded-[20px]"
          // Deep red, brightest where the campaign stands and falling away to
          // the corners, with the design's faint diagonal banding over it.
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, rgba(255,255,255,0.045) 0 22px, transparent 22px 54px), radial-gradient(120% 95% at 42% 38%, #d8261a 0%, #a81a13 48%, #5f0d0a 100%)",
          }}
        >
          {/* The gap between the campaign and the rail, and the padding on
              the right, are both widened from lg so the arrows have somewhere
              of their own to stand. At the design's offsets they sat on the
              first card's badge and the last card's edge. */}
          <div className="grid items-center gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-14 lg:pr-14 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            {/* The campaign. A row on a phone — lockup and clock side by side
                — because stacked it filled the screen before a single product
                appeared. */}
            <div className="flex items-center gap-3 lg:flex-col lg:justify-center lg:gap-3">
              <div className="min-w-0 flex-1 lg:flex-none">
                {art.lockup ? (
                  <Image
                    src={LOCKUP_SRC}
                    alt={title}
                    width={377}
                    height={208}
                    className="h-auto w-[140px] md:w-[190px] lg:w-[250px]"
                    onError={() => setArt((a) => ({ ...a, lockup: false }))}
                  />
                ) : (
                  <p className="text-2xl font-black italic leading-none tracking-tight text-amber-300 drop-shadow-[0_3px_0_rgba(0,0,0,0.35)] md:text-4xl">
                    FLASH
                    <br />
                    SALE
                  </p>
                )}
              </div>

              {cfg.endsAt && !expired && (
                <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
                  <Box>{left ? `${left.h}h` : "--"}</Box>
                  <span className="text-lg font-extrabold text-white md:text-2xl">:</span>
                  <Box>{left ? pad(left.m) : "--"}</Box>
                  <span className="text-lg font-extrabold text-white md:text-2xl">:</span>
                  <Box>{left ? pad(left.s) : "--"}</Box>
                </div>
              )}

              {art.mascot && (
                <Image
                  src={MASCOT_SRC}
                  alt=""
                  aria-hidden
                  width={483}
                  height={426}
                  className="hidden h-auto w-[230px] lg:block xl:w-[290px]"
                  onError={() => setArt((a) => ({ ...a, mascot: false }))}
                />
              )}
            </div>

            {/* What is on sale. */}
            <div className="relative min-w-0">
              <ul
                ref={railRef}
                className="-m-2 flex snap-x snap-mandatory gap-3 overflow-x-auto p-2 scrollbar-none md:gap-4"
              >
                {shelf.map((p) => (
                  <li
                    key={p.slug}
                    // Five across on a wide screen: at four the row ended
                    // well short of the band's right edge and the campaign
                    // beside it looked like it had run out of things to sell.
                    className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start md:w-[calc((100%-3rem)/3.5)] xl:w-[calc((100%-4rem)/5)]"
                  >
                    <FlashSaleCard product={p} />
                  </li>
                ))}
              </ul>
              <RailArrows railRef={railRef} />
            </div>
          </div>

          <Link
            href={href}
            className="flex items-center justify-center gap-1 px-4 pb-4 text-sm font-bold text-white/90 transition-colors hover:text-white md:pb-5"
          >
            ดูทั้งหมด <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Scrolls the rail by about a screenful. From lg only, which is where the
 *  band has gutters wide enough to hold them: below that there is no room
 *  beside the cards, so they would end up sitting on one — and a thumb there
 *  drags rather than aims at a 40px target.
 *
 *  52px out, not 44: the rail carries `-m-2 p-2` so its cards start 8px
 *  outside this wrapper, and at 44 the buttons still clipped the first and
 *  last card by four pixels. */
function RailArrows({ railRef }: { railRef: React.RefObject<HTMLUListElement | null> }) {
  const busy = useRef(false);
  function scrollBy(dir: 1 | -1) {
    const el = railRef.current;
    if (!el || busy.current) return;
    busy.current = true;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
    setTimeout(() => (busy.current = false), 350);
  }
  return (
    <>
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="สินค้าก่อนหน้า"
        className="absolute -left-13 top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-500 shadow-card transition-colors hover:text-brand-800 lg:grid"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="สินค้าถัดไป"
        className="absolute -right-13 top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-500 shadow-card transition-colors hover:text-brand-800 lg:grid"
      >
        <ChevronRight size={20} />
      </button>
    </>
  );
}
