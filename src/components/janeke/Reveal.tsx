"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";

/**
 * Scroll-triggered entrances for the Janeke landing page.
 *
 * Local to this page rather than the site-wide ScrollReveal, which is a
 * deliberate no-op: turning that one back on would animate every call site
 * across the shop, which is somebody else's decision to make.
 *
 * Everything here is opacity and transform only — the two properties a
 * browser can animate without laying the page out again — and all of it is
 * skipped outright when the visitor has asked for less motion.
 */

type Kind = "up" | "left" | "right" | "scale";

const FROM: Record<Kind, { opacity: number; x?: number; y?: number; scale?: number }> = {
  up: { opacity: 0, y: 28 },
  left: { opacity: 0, x: -32 },
  right: { opacity: 0, x: 32 },
  scale: { opacity: 0, scale: 0.94 },
};

export default function Reveal({
  children,
  className,
  kind = "up",
  delay = 0,
  /** Degrees to settle at — for the prints, which hang at an angle. */
  rotate,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  kind?: Kind;
  delay?: number;
  rotate?: number;
  style?: React.CSSProperties;
}) {
  const still = useReducedMotion();

  if (still) {
    return (
      <div className={className} style={rotate ? { ...style, rotate: `${rotate}deg` } : style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ ...FROM[kind], rotate: rotate ? rotate - 6 : undefined }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: rotate ?? 0 }}
      // once: the page is long and a section that re-animates on the way back
      // up reads as a glitch rather than a flourish.
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** A group whose children arrive one after another. */
export function RevealGroup({
  children,
  className,
  gap = 0.09,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
}) {
  const still = useReducedMotion();
  if (still) return <div className={className}>{children}</div>;

  const list: Variants = { show: { transition: { staggerChildren: gap } } };
  return (
    <motion.div
      className={className}
      variants={list}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

const ITEM: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

/** One line of a RevealGroup. */
export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const still = useReducedMotion();
  if (still) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={ITEM}>
      {children}
    </motion.div>
  );
}
