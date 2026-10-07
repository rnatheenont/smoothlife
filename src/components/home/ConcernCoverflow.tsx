"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { concerns, concernImage } from "@/data/categories";
import { products } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import { useRailFade } from "@/lib/use-rail-fade";

// Shop by concern, as a fanned-out stack rather than a row of equal tiles.
//
// The point of the shape is that the heading belongs to the card in the
// middle: one concern is named in full, at size, and the others are visibly
// waiting their turn. A six-across grid names all six at once in small type,
// which is a list of problems — this asks one question at a time.
//
// Every card stays a real link whatever position it is in, so nothing is
// reachable only by first scrolling it to the centre. The ones that have
// faded out are the exception: they are inert and out of the tab order,
// because a link nobody can see is not a shortcut, it is a trap.
//
// A click on a card off to one side brings it to the middle instead of
// following its link: with the shelf underneath reading from whatever is in
// the middle, a side card is a thing to choose, and only the one already
// chosen is a thing to open.

const SWIPE_THRESHOLD = 40;
/** How long each card holds the middle before the stack moves on. Long
 *  enough to read the name under it and glance at the shelf. */
const AUTO_MS = 5500;
/** Ten in the rail, six of them whole and a seventh fading out at the edge:
 *  the fade only means anything while there is still something behind it. */
const SHOWN = 10;

/** Where a card sits, given how far it is from the one in the middle. */
function placement(offset: number) {
  const side = Math.sign(offset);
  const distance = Math.abs(offset);
  if (distance === 0) return { x: 0, y: 0, scale: 1, rotate: 0, z: 30, opacity: 1, shown: true };
  if (distance === 1) return { x: side * 62, y: 4, scale: 0.84, rotate: side * 8, z: 20, opacity: 0.45, shown: true };
  if (distance === 2) return { x: side * 112, y: 14, scale: 0.68, rotate: side * 13, z: 10, opacity: 0.22, shown: true };
  return { x: side * 150, y: 22, scale: 0.6, rotate: side * 16, z: 0, opacity: 0, shown: false };
}

export default function ConcernCoverflow() {
  const rail = useRailFade();
  const [active, setActive] = useState(0);
  const dragX = useRef<number | null>(null);
  const count = concerns.length;
  const current = concerns[active];

  // In stock and with a picture: a shelf of grey placeholders under the name
  // of somebody's skin problem says less about it than showing nothing.
  const shelf = useMemo(
    () =>
      products
        .filter((p) => p.concerns.includes(current.slug) && p.inStock && p.image)
        .slice(0, SHOWN),
    [current.slug]
  );

  // Shortest way round, so stepping off either end wraps instead of flying
  // the whole stack across the screen.
  function offsetOf(i: number) {
    let d = i - active;
    if (d > count / 2) d -= count;
    if (d < -count / 2) d += count;
    return d;
  }
  const step = (d: number) => setActive((i) => (i + d + count) % count);

  // Moves on by itself until somebody takes hold of it, and then stops for
  // good. The shelf underneath reads from whatever is in the middle, so a
  // stack that kept turning would swap the products out from under the
  // person who had just stopped to look at them.
  const [engaged, setEngaged] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (engaged || hovered) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % count), AUTO_MS);
    return () => clearInterval(timer);
  }, [engaged, hovered, count]);

  /** Every manual control goes through here, so none of them forgets to
   *  stop the carousel. */
  const take = (fn: () => void) => () => {
    setEngaged(true);
    fn();
  };

  function onPointerDown(e: ReactPointerEvent) {
    dragX.current = e.clientX;
  }
  function onPointerUp(e: ReactPointerEvent) {
    const from = dragX.current;
    dragX.current = null;
    if (from === null) return;
    const dx = e.clientX - from;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      setEngaged(true);
      step(dx < 0 ? 1 : -1);
    }
  }

  return (
    <section className="overflow-hidden bg-brand-radial py-10 md:py-14 lg:py-16">
      <div className="container-page text-center">
        <p className="text-sm font-medium text-brand-ink md:text-lg">ปัญหาผิวที่กังวล</p>
        {/* aria-live so the name arriving with a new card is announced; the
            cards themselves are links and say their own name. */}
        <h2 aria-live="polite" className="mt-1 text-[26px] font-bold text-brand-teal md:text-[36px] lg:text-[42px]">
          {current.nameTh}
        </h2>
      </div>

      <div
        className="relative mx-auto mt-7 h-[230px] w-full max-w-[1512px] touch-pan-y select-none md:mt-10 md:h-[330px] lg:h-[380px]"
        onPointerDown={onPointerDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (dragX.current = null)}
      >
        {concerns.map((c, i) => {
          const p = placement(offsetOf(i));
          return (
            <Link
              key={c.slug}
              href={`/concern/${c.slug}`}
              onClick={(e) => {
                if (i === active) return;
                e.preventDefault();
                setEngaged(true);
                setActive(i);
              }}
              aria-hidden={!p.shown}
              tabIndex={p.shown ? undefined : -1}
              style={{
                transform: `translate(-50%, -50%) translate(${p.x}%, ${p.y}%) rotate(${p.rotate}deg) scale(${p.scale})`,
                zIndex: p.z,
                opacity: p.opacity,
              }}
              className="absolute left-1/2 top-1/2 block aspect-[6/5] w-[min(72vw,400px)] overflow-hidden rounded-[22px] bg-white shadow-card transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none md:w-[min(74vw,400px)]"
            >
              <Image
                src={concernImage(c.slug)}
                alt={c.nameTh}
                fill
                sizes="(max-width:768px) 74vw, 400px"
                className="object-cover"
              />
            </Link>
          );
        })}

        {/* Arrows live outside the stack so a press never lands on whichever
            card happens to be underneath them. */}
        <button
          type="button"
          onClick={take(() => step(-1))}
          aria-label="ปัญหาผิวก่อนหน้า"
          // On a phone the arrow and the card were both as far out as they
          // could go and still landed on each other — 40px of button from
          // 12px in, against a card starting at 49px. A size smaller, two
          // pixels further out and a slightly narrower card puts 8px of air
          // between them on each side.
          className="absolute left-2 top-1/2 z-40 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-ink shadow-card transition-colors hover:bg-white md:left-8 md:h-10 md:w-10 lg:left-16"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={take(() => step(1))}
          aria-label="ปัญหาผิวถัดไป"
          className="absolute right-2 top-1/2 z-40 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-ink shadow-card transition-colors hover:bg-white md:right-8 md:h-10 md:w-10 lg:right-16"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* The shelf the middle card is pointing at. Same panel as the brand
          row's, for the same reason: the question "what do you sell for
          this" is answered on the page that asked it. */}
      <div className="mx-auto mt-6 max-w-[1512px] px-4 md:px-6">
                  {shelf.length > 0 ? (
            <>
              {/* A rail at every width, and on a wide screen it is cut to
                  show four and a half: the half card is what says there is
                  more to the right, where five that fit exactly says there
                  is not. */}
              <ul // -m-2 p-2: overflow-x-auto clips on both axes, so without room
                  // inside it the cards' shadows and rounded corners were being
                  // sliced flat against the top and bottom of the rail.
                  ref={rail.ref}
                  style={rail.style}
                  // A phone has no hover to pause on: a thumb dragging the
                  // shelf sideways is the signal there, and it is the same
                  // signal as any other — hand the carousel over for good.
                  onScroll={() => setEngaged(true)}
                  className="-m-2 flex snap-x snap-mandatory gap-3 overflow-x-auto p-2 scrollbar-none md:gap-4">
                {shelf.map((p) => (
                  <li
                    key={p.slug}
                    // Two and a half on a phone, three and a half on a
                    // tablet, six and a half on a desktop — the part-card is
                    // what says the rail keeps going.
                    className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start md:w-[calc((100%-3rem)/3.5)] lg:w-[calc((100%-6rem)/6.5)]"
                  >
                    <ProductCard product={p} />
                  </li>
                ))}
              </ul>
              <Link
                href={`/concern/${current.slug}`}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-600"
              >
                ดูทั้งหมดสำหรับ{current.nameTh}
                <ChevronRight size={16} />
              </Link>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">
              ตอนนี้สินค้าสำหรับ{current.nameTh}หมดชั่วคราว{" "}
              <Link href={`/concern/${current.slug}`} className="font-semibold text-brand-800">
                ดูหน้าปัญหาผิวนี้
              </Link>
            </p>
          )}
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {concerns.map((c, i) => (
          <button
            key={c.slug}
            type="button"
            onClick={take(() => setActive(i))}
            aria-label={c.nameTh}
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
