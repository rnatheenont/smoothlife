"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// The mascot, watching the cursor.
//
// The artwork is a flat PNG, so there are no pupils to rotate. Two things
// stand in for it and together read as looking: the whole head leans a few
// pixels towards the pointer, and a highlight inside each eye leans further,
// which is the same trick a cartoonist uses to point a gaze.
//
// The eye positions are measured off the file rather than eyeballed — the
// two largest dark blobs in public/mascot/smoothie-new.png, as fractions of
// its 1254px square. The box this renders into has to stay square for those
// fractions to land, which is what object-contain on a square source gives.
//
// Nothing moves without a real mouse: a touch screen has no cursor to
// follow, and someone who asked for less motion has asked for this too.

const EYES = [
  { x: 40.4, y: 55.3 },
  { x: 65.2, y: 54.3 },
];
/** Highlight diameter, as a % of the box. The eye is 5.8% wide and 8.3%
 *  tall, so this leaves room to move without sliding off the black. */
const GLINT = 2;
/** How far the highlight travels inside the eye, as a % of the box. */
const GLINT_X = 1.2;
const GLINT_Y = 1.5;
/** How far the head itself leans, in px. More than this and it stops being
 *  a glance and starts being a lunge. */
const HEAD_X = 8;
const HEAD_Y = 5;

export default function SmoothieMascot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let point = { x: 0, y: 0 };

    function settle() {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      // Aim from the eyes, not the middle of the box: the head sits in the
      // top two thirds of it and the gaze looked permanently downcast when
      // measured from the centre.
      const cy = r.top + r.height * 0.45;
      // Fully deflected about a head's width away; past that it is already
      // looking as far as it can.
      const span = Math.max(r.width, 1);
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      setGaze({ x: clamp((point.x - cx) / span), y: clamp((point.y - cy) / span) });
    }

    function onMove(e: PointerEvent) {
      point = { x: e.clientX, y: e.clientY };
      // One read per frame: pointermove fires far more often than the screen
      // draws, and getBoundingClientRect is a layout read.
      if (!frame) frame = requestAnimationFrame(settle);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    // Two nested transforms rather than one: the bob is a CSS animation on
    // `transform`, and an inline transform on the same element would replace
    // it outright.
    <div ref={ref} className={className}>
      <div className="h-full w-full origin-bottom animate-headBob">
        <div
          className="relative h-full w-full transition-transform duration-200 ease-out"
          style={{ transform: `translate(${gaze.x * HEAD_X}px, ${gaze.y * HEAD_Y}px)` }}
        >
          {/* The character in the design is a full-body one in a lab coat
              that public/mascot does not have — every file there is a head.
              This is the same head the chat widget uses, so at least it is
              the mascot the shopper meets next. */}
          <Image
            src="/mascot/smoothie-new.png"
            alt=""
            fill
            sizes="320px"
            className="object-contain object-bottom"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 transition-transform duration-200 ease-out"
            style={{ transform: `translate(${gaze.x * GLINT_X}%, ${gaze.y * GLINT_Y}%)` }}
          >
            {EYES.map((eye) => (
              <span
                key={eye.x}
                className="absolute rounded-full bg-white/90"
                style={{
                  left: `${eye.x - GLINT / 2}%`,
                  // A touch above the middle of the eye, where a highlight
                  // falls when the light is in front and above.
                  top: `${eye.y - GLINT / 2 - 1.4}%`,
                  width: `${GLINT}%`,
                  height: `${GLINT}%`,
                }}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
