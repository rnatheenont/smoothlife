"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

/** The window height the `distance` figures are written for. */
const BASE_VH = 700;

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
 * It is a distance for a phone-sized window, scaled up for taller ones. The
 * travel is spread over the whole time the card is on screen, so on a tall
 * desktop window a fixed number of pixels is spread over twice the scrolling
 * and reads as not moving at all — measured at 1080px tall, a 56px drift came
 * out as 3px of movement across a thousand pixels of scroll.
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
  const [travel, setTravel] = useState(distance);

  useEffect(() => {
    const read = () => setTravel(distance * Math.max(1, window.innerHeight / BASE_VH));
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [distance]);

  // offset: from the card's top meeting the bottom of the window, to its
  // bottom leaving the top — the whole time any part of it is on screen.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [travel / 2, -travel / 2]);

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
