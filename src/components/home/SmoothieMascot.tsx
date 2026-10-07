"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// The mascot, watching the cursor — eyes first, head second.
//
// The artwork is a flat PNG, so the eyes in it cannot move. They are covered
// instead and redrawn: a patch of the face's own colour hides each painted
// eye, and a black oval of the same shape is drawn on top of it and shifted
// towards the pointer. This character's eyes are solid black with no whites,
// so moving the whole oval is what "looking" looks like for it.
//
// Three numbers decide whether that reads or falls apart, and all three are
// measured off the file rather than guessed:
//
//  - where the eyes are — the two largest dark blobs in the 1254px square,
//    as fractions of it;
//  - how big they are — so the drawn oval matches the one being covered;
//  - what colour to cover them with — sampled from a ring just outside each
//    eye. The face is shaded, so the two eyes sit on noticeably different
//    skin (#ecc09d on the left, #fbd1b2 on the right) and one flat tone for
//    both would show as a patch.
//
// The patch is a radial gradient that fades to the same colour at zero alpha
// rather than a hard-edged ellipse: a soft edge disappears into the shading
// around it, where a crisp one would read as a sticker.
//
// The box this renders into has to stay square for those fractions to land,
// which is what object-contain on a square source gives.

type Eye = {
  /** Centre, as a % of the box. */
  cx: number;
  cy: number;
  /** Size, as a % of the box. */
  w: number;
  h: number;
  /** The face immediately around this eye. */
  skin: string;
};

const EYES: Eye[] = [
  { cx: 40.4, cy: 55.3, w: 5.9, h: 8.5, skin: "236,192,157" },
  { cx: 65.2, cy: 54.3, w: 5.7, h: 8.1, skin: "251,209,178" },
];

/** The cover, relative to the eye it hides. Bigger than the eye in both
 *  directions so the fade starts clear of it. */
const PATCH_W = 1.9;
const PATCH_H = 1.65;

/** The drawn eye, relative to the painted one it replaces. Over 1 because
 *  the measurements are of the original art and the brief was for bigger
 *  eyes; it only ever helps the cover, which is sized against the smaller
 *  shape underneath. */
const EYE_SCALE = 1.2;

/** A blink: how long the eye stays shut, and the gap before the next one.
 *  A real blink is about a tenth of a second — anything slower reads as a
 *  slow wink. The gap is random so the face never looks metronomic, and one
 *  in four comes in a pair, which is what eyes actually do. */
const BLINK_MS = 110;
const BLINK_GAP = [2500, 6500];
const DOUBLE_BLINK_CHANCE = 0.25;
const DOUBLE_BLINK_GAP = 150;

/** The mouth it opens into when the pointer is on it, as a % of the box.
 *  Wider and taller than the painted smile (4.6% x 1.5%, centred on 52.4%,
 *  61.7%), which is why no patch is needed here: a filled shape that covers
 *  the thin dark curve outright is its own cover. */
const MOUTH = { left: 47.6, top: 61.2, width: 9.6, height: 5.6 };

/** How far the eyes travel, and then the head, as fractions of the box. The
 *  eyes carry most of it — a head that leans as far as the eyes look is a
 *  character lunging at the cursor rather than glancing at it. */
const EYE_X = 0.013;
const EYE_Y = 0.011;
const HEAD_X = 0.02;
const HEAD_Y = 0.013;

export default function SmoothieMascot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0, size: 0 });
  const [smiling, setSmiling] = useState(false);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // One timer at a time, each one booking the next, so the gaps can be
    // random without an interval firing underneath them.
    let timer: ReturnType<typeof setTimeout>;
    const after = (ms: number, fn: () => void) => {
      timer = setTimeout(fn, ms);
    };
    const close = (then: () => void) => {
      setBlinking(true);
      after(BLINK_MS, () => {
        setBlinking(false);
        then();
      });
    };
    const schedule = () => {
      const [min, max] = BLINK_GAP;
      after(min + Math.random() * (max - min), () =>
        close(() =>
          Math.random() < DOUBLE_BLINK_CHANCE
            ? after(DOUBLE_BLINK_GAP, () => close(schedule))
            : schedule()
        )
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

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
      setGaze({
        x: clamp((point.x - cx) / span),
        y: clamp((point.y - cy) / span),
        // Carried along so the offsets below can be in real pixels and still
        // hold if the box is ever given another size.
        size: r.width,
      });
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

  const eyeX = gaze.x * EYE_X * gaze.size;
  const eyeY = gaze.y * EYE_Y * gaze.size;

  return (
    // Two nested transforms rather than one: the bob is a CSS animation on
    // `transform`, and an inline transform on the same element would replace
    // it outright.
    <div
      ref={ref}
      className={className}
      onPointerEnter={() => setSmiling(true)}
      onPointerLeave={() => setSmiling(false)}
    >
      <div className="h-full w-full origin-bottom animate-headBob">
        <div
          className="relative h-full w-full transition-transform duration-200 ease-out"
          style={{
            transform: `translate(${gaze.x * HEAD_X * gaze.size}px, ${gaze.y * HEAD_Y * gaze.size}px)`,
          }}
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
          {EYES.map((eye) => (
            <span
              key={eye.cx}
              aria-hidden="true"
              className="absolute"
              style={{
                left: `${eye.cx - (eye.w * PATCH_W) / 2}%`,
                top: `${eye.cy - (eye.h * PATCH_H) / 2}%`,
                width: `${eye.w * PATCH_W}%`,
                height: `${eye.h * PATCH_H}%`,
                background: `radial-gradient(farthest-side, rgb(${eye.skin}) 62%, rgba(${eye.skin},0) 100%)`,
              }}
            >
              {/* Two elements, because the two movements want different
                  speeds on the same property: the gaze glides over 200ms and
                  a blink has to snap shut in 110ms. */}
              <span
                className="absolute left-1/2 top-1/2 transition-transform duration-200 ease-out"
                style={{
                  width: `${(100 / PATCH_W) * EYE_SCALE}%`,
                  height: `${(100 / PATCH_H) * EYE_SCALE}%`,
                  transform: `translate(calc(-50% + ${eyeX}px), calc(-50% + ${eyeY}px))`,
                }}
              >
                <span
                  // border-radius 50%, not rounded-full: a 9999px radius on a
                  // box taller than it is wide clamps to half the width and
                  // gives a capsule with straight sides, which is a pill, not
                  // an eye.
                  className="relative block h-full w-full bg-[#17110d] transition-transform duration-[110ms] ease-out"
                  style={{
                    borderRadius: "50%",
                    // Shut for a blink; narrowed a little while it smiles,
                    // because eyes that stay wide open under a grin read as a
                    // mask rather than a mood.
                    transform: `scaleY(${blinking ? 0.06 : smiling ? 0.88 : 1})`,
                  }}
                >
                  {/* The catchlight rides on the eye, which is what stops the
                      oval reading as a hole punched in the face. */}
                  <span className="absolute left-[20%] top-[14%] h-[22%] w-[30%] rounded-full bg-white/90" />
                </span>
              </span>
            </span>
          ))}

          {/* The smile opens downwards from a flat top, so it grows out of
              the painted mouth rather than appearing on top of it. */}
          <span
            aria-hidden="true"
            className="absolute overflow-hidden bg-[#241a14] transition-all duration-300 ease-out"
            style={{
              left: `${MOUTH.left}%`,
              top: `${MOUTH.top}%`,
              width: `${MOUTH.width}%`,
              height: smiling ? `${MOUTH.height}%` : "0%",
              opacity: smiling ? 1 : 0,
              borderRadius: "0 0 50% 50% / 0 0 100% 100%",
            }}
          >
            <span
              className="absolute bottom-[6%] left-1/2 h-[46%] w-[48%] -translate-x-1/2 bg-[#f4808a]"
              style={{ borderRadius: "50%" }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
