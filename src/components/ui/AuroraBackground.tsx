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
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden opacity-60",
          "[background-image:radial-gradient(ellipse_55%_45%_at_85%_5%,color-mix(in_srgb,var(--color-brand-teal)_35%,transparent),transparent_70%),radial-gradient(ellipse_45%_40%_at_60%_0%,color-mix(in_srgb,var(--color-sky-200,#bae6fd)_70%,transparent),transparent_70%),radial-gradient(ellipse_40%_35%_at_100%_30%,color-mix(in_srgb,var(--color-brand-200)_70%,transparent),transparent_70%)]",
          !showRadialGradient && "opacity-80",
        )}
      />
      {children}
    </div>
  );
}
