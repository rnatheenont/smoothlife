"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Slow coloured light behind a page.
//
// Adapted rather than pasted. The version this came from assumes Tailwind 3
// with a config file and a plugin that publishes every palette colour as a
// bare CSS variable (`var(--blue-500)`); this project is on Tailwind 4, where
// the palette already lives in @theme as `--color-*` and there is no config
// to extend. So the gradient names the variables this codebase actually has,
// and the keyframes live in theme.css beside every other animation here.
//
// It drops the dark-mode half — the storefront has one theme, and a dark
// branch nothing can reach is a branch that rots — but keeps `invert`, which
// is not decoration. The layer paints its own colours and then differences
// them against itself; without the inversion the result on a white page is a
// grey-and-pink haze with none of the brand in it. Checked on screen both
// ways, not reasoned about.

export default function AuroraBackground({
  className,
  children,
  /** Fades the light out towards the bottom-left, so it reads as coming from
   *  somewhere rather than filling the box evenly. */
  showRadialGradient = true,
}: {
  className?: string;
  children?: ReactNode;
  showRadialGradient?: boolean;
}) {
  return (
    <div className={cn("relative isolate", className)}>
      {/* aria-hidden and pointer-events-none: it is weather, not content, and
          nothing in it should ever take a tap meant for the page. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={cn(
            // Two stacked repeating gradients: a white one that breaks the
            // colour into bands, and the colour itself. The second copy in
            // ::after is the one that moves — animating a background that is
            // also doing the masking makes the bands swim rather than drift.
            "absolute -inset-[10px] opacity-45 will-change-transform",
            "[--aurora:repeating-linear-gradient(100deg,var(--color-brand-400)_10%,var(--color-brand-200)_15%,var(--color-sky-200,#bae6fd)_20%,var(--color-brand-teal)_25%,var(--color-brand-600)_30%)]",
            "[--band:repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)]",
            "[background-image:var(--band),var(--aurora)]",
            "[background-size:300%,_200%] [background-position:50%_50%,50%_50%]",
            "blur-[10px] invert",
            'after:absolute after:inset-0 after:content-[""]',
            "after:[background-image:var(--band),var(--aurora)]",
            "after:[background-size:200%,_100%] after:[background-attachment:fixed]",
            "after:mix-blend-difference after:animate-aurora",
            // Someone who has asked for less movement gets the colour and
            // none of the drift.
            "motion-reduce:after:animate-none",
            showRadialGradient &&
              "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]",
          )}
        />
      </div>
      {children}
    </div>
  );
}
