"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

/**
 * A card that drifts upward as the page scrolls past it.
 *
 * Tied to the scroll position rather than run on a timer, so it tracks a
 * trackpad exactly and stops when the finger stops — the same way the comb on
 * the colour picker behaves, so the two read as one page.
 *
 * `distance` is how far it travels in total, split either side of centre: the
 * card sits `distance / 2` low when it enters the window and the same amount
 * high as it leaves. Keeping the middle of the travel at zero means the card
 * is where the layout puts it at the moment it is most likely to be read.
 *
 * Separate element from the entrance animation that usually wraps it: both
 * drive `transform`, and one would overwrite the other on a single node.
 */
export default function Lift({
  children,
  className,
  distance = 70,
}: {
  children: React.ReactNode;
  className?: string;
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();

  // offset: from the card's top meeting the bottom of the window, to its
  // bottom leaving the top — the whole time any part of it is on screen.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance / 2, -distance / 2]);

  if (still) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}
