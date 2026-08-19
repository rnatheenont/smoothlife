"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scheduleScrollTriggerRefresh } from "@/lib/gsap-scroll-refresh";

let pluginRegistered = false;

// Like ScrollReveal, but pops each direct child in individually (scale +
// fade, staggered) instead of animating the whole block as one unit — for
// grids/rows of tiles where each item should feel like its own little
// arrival rather than the section just sliding up together.
export default function StaggerGrid({
  children,
  className,
  stagger = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pluginRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      pluginRegistered = true;
    }
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.children,
        { opacity: 0, y: 20, scale: 0.85 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          stagger,
          ease: "back.out(1.6)",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );
    }, ref);
    scheduleScrollTriggerRefresh();

    return () => ctx.revert();
  }, [stagger]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
