"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export type FaqCard = {
  question: string;
  answer: React.ReactNode;
  image: string;
  alt: string;
};

/**
 * The questions, as a deck you turn rather than a column you scroll.
 *
 * The card in the middle is the one being read: full size, square on, and in
 * front. Its neighbours are smaller, pushed aside and set back, so the deck
 * reads as having depth and it is obvious there is more to either side.
 *
 * The deck wraps: distance is measured the short way round, so there is a
 * card either side of the middle one whichever is being read, rather than an
 * empty half at each end of the list.
 *
 * Three are on show: the one being read and its two neighbours.
 *
 * They are stacked in one grid cell rather than positioned absolutely, which
 * is what makes them the same height: a grid row is as tall as its tallest
 * item and the others stretch to meet it, so the deck stays square whatever
 * length the answers run to — no fixed height to outgrow.
 *
 * Every card stays in that cell, including the ones out of view, and they are
 * faded out rather than dropped. A dropped card takes its height with it, and
 * the deck would then grow and shrink as the longest answer came in and out of
 * the set of three — which is the kind of thing that only shows up after
 * somebody adds a question.
 *
 * Driven by one number — which card is active. Everything else is derived
 * from the distance to it, so the arrows, the swipe, the keyboard and the
 * dots can never disagree about what is showing.
 */

/** How many cards either side of the middle one are on show. */
const WINGS = 1;

/** Where a card sits, given how far it is from the one being read. */
function at(offset: number, narrow: boolean) {
  const side = narrow ? 56 : 62;
  return {
    x: `${offset * side}%`,
    scale: offset === 0 ? 1 : 0.82,
    opacity: offset === 0 ? 1 : 0.65,
    zIndex: 10 - Math.abs(offset),
    rotateY: offset === 0 ? 0 : offset > 0 ? -10 : 10,
  };
}

export default function FaqCarousel({ cards }: { cards: FaqCard[] }) {
  const [active, setActive] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const still = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number } | null>(null);

  useEffect(() => {
    const read = () => setNarrow(window.innerWidth < 768);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  const go = useCallback(
    (delta: number) => setActive((i) => (i + delta + cards.length) % cards.length),
    [cards.length],
  );

  /** How far card `i` is from the one being read, the short way round. */
  const distance = (i: number) => {
    const n = cards.length;
    return ((((i - active) % n) + n + Math.floor(n / 2)) % n) - Math.floor(n / 2);
  };

  return (
    <div className="mt-10 md:mt-16">
      <div
        ref={stage}
        role="group"
        aria-roledescription="carousel"
        aria-label="คำถามที่พบบ่อยเกี่ยวกับแปรง Jäneke"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(-1);
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(1);
          }
        }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX };
        }}
        onPointerUp={(e) => {
          const from = drag.current;
          drag.current = null;
          if (!from) return;
          const moved = e.clientX - from.x;
          // 40px: far enough that a tap on a card is never read as a swipe.
          if (Math.abs(moved) > 40) go(moved < 0 ? 1 : -1);
        }}
        className="relative mx-auto grid touch-pan-y justify-items-center outline-none [perspective:1400px]"
      >
        {cards.map((c, i) => {
          const offset = distance(i);
          const shown = Math.abs(offset) <= WINGS;
          const pose = at(offset, narrow);
          return (
            <motion.article
              key={c.question}
              className="flex w-[16rem] origin-center flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.16)] [grid-area:1/1] md:w-[20rem] md:rounded-[2rem]"
              style={{
                zIndex: pose.zIndex,
                transformStyle: "preserve-3d",
                pointerEvents: shown ? undefined : "none",
              }}
              animate={{
                x: pose.x,
                scale: pose.scale,
                opacity: shown ? pose.opacity : 0,
                rotateY: pose.rotateY,
              }}
              transition={still ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 26 }}
              // A card to the side is a shortcut to itself; the middle one is
              // already being read, so it is not a button.
              onClick={() => shown && offset !== 0 && setActive(i)}
              aria-hidden={offset !== 0}
            >
              <Image
                src={c.image}
                alt={c.alt}
                width={760}
                height={760}
                className="aspect-square w-full shrink-0 object-cover"
              />
              <div className="flex flex-1 flex-col justify-center px-6 py-6 text-center md:px-8 md:py-7">
                <h3 className="text-[clamp(0.85rem,1.3vw,1.05rem)] font-bold tracking-wide text-[#685048]">
                  {c.question}
                </h3>
                <p className="mt-3 text-[clamp(0.75rem,1vw,0.9rem)] leading-relaxed text-[#78716f]">
                  {c.answer}
                </p>
              </div>
            </motion.article>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="คำถามก่อนหน้า"
          className="grid size-11 place-items-center rounded-full border border-[#d8d2cd] text-[#685048] transition-colors hover:border-[#685048]"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2">
          {cards.map((c, i) => (
            <button
              key={c.question}
              type="button"
              onClick={() => setActive(i)}
              aria-label={c.question}
              aria-current={i === active}
              className={`h-2 rounded-full transition-all ${
                i === active ? "w-6 bg-[#685048]" : "w-2 bg-[#d8d2cd] hover:bg-[#b5aca5]"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="คำถามถัดไป"
          className="grid size-11 place-items-center rounded-full border border-[#d8d2cd] text-[#685048] transition-colors hover:border-[#685048]"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
