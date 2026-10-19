"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export type FaqCard = {
  question: string;
  answer: React.ReactNode;
  /** A photograph, where there is one. */
  image?: string;
  alt?: string;
  /** Otherwise a cut-out on a tint, keyed to that brush's own colours. */
  cutout?: string;
  tint?: [string, string];
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
 * Cards more than two away are left out of the DOM rather than hidden, so a
 * long list stays cheap however many are added.
 *
 * Driven by one number — which card is active. Everything else is derived
 * from the distance to it, so the arrows, the swipe, the keyboard and the
 * dots can never disagree about what is showing.
 */

/** Where a card sits, given how far it is from the one being read. */
function at(offset: number, narrow: boolean) {
  const side = narrow ? 56 : 62;
  return {
    x: `${offset * side}%`,
    scale: offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.82 : 0.66,
    opacity: Math.abs(offset) > 2 ? 0 : offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.65 : 0.3,
    zIndex: 10 - Math.abs(offset),
    rotateY: offset === 0 ? 0 : offset > 0 ? -18 : 18,
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
        className="relative mx-auto flex h-[34rem] touch-pan-y items-center justify-center outline-none md:h-[37rem] [perspective:1400px]"
      >
        {cards.map((c, i) => {
          const offset = distance(i);
          if (Math.abs(offset) > 2) return null;
          const pose = at(offset, narrow);
          return (
            <motion.article
              key={c.question}
              className="absolute w-[16rem] origin-center overflow-hidden rounded-[1.5rem] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.16)] md:w-[20rem] md:rounded-[2rem]"
              style={{ zIndex: pose.zIndex, transformStyle: "preserve-3d" }}
              animate={{ x: pose.x, scale: pose.scale, opacity: pose.opacity, rotateY: pose.rotateY }}
              transition={still ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 26 }}
              // A card to the side is a shortcut to itself; the middle one is
              // already being read, so it is not a button.
              onClick={() => offset !== 0 && setActive(i)}
              aria-hidden={offset !== 0}
            >
              {c.image ? (
                <Image
                  src={c.image}
                  alt={c.alt ?? ""}
                  width={1080}
                  height={1350}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div
                  className="grid aspect-square w-full place-items-center p-7"
                  style={{
                    backgroundImage: `linear-gradient(145deg, ${c.tint?.[0] ?? "#f1efed"}, ${c.tint?.[1] ?? "#ffffff"})`,
                  }}
                >
                  {c.cutout && (
                    <Image
                      src={c.cutout}
                      alt={c.alt ?? ""}
                      width={372}
                      height={900}
                      className="h-full w-auto object-contain drop-shadow-[0_14px_26px_rgba(15,23,42,0.2)]"
                    />
                  )}
                </div>
              )}
              <div className="px-6 py-6 text-center md:px-8 md:py-7">
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
