// Likes drifting up behind the clips.
//
// The section is a wall of short vertical videos, so the one thing in its
// world that is not a video is the stream of reactions that runs up the side
// of a live one. That is what this is: hearts rising, leaning as they go,
// fading in on the way up and out again near the top.
//
// Kept to the edges of the band on purpose. The stack of clips sits in the
// middle and a heart crossing a face is a distraction, not an atmosphere, so
// every one of them starts in the outer fifth or so of the width — which is
// also what lets there be eighteen of them without the section looking busy.
//
// Decoration: aria-hidden, pointer-events-none, and each heart animates only
// its own transform and opacity, so the lot of them cost a composited layer
// each rather than a repaint. The site's reduced-motion rule stops them.

type Heart = {
  /** % across the band. */
  left: number;
  /** px, the heart's width. */
  size: number;
  seconds: number;
  /** Seconds before it first sets off, so they never rise in formation. */
  delay: number;
  /** How far it leans on the way up, in px. */
  sway: number;
  colour: string;
};

const HEARTS: Heart[] = [
  // Left edge.
  { left: 2, size: 26, seconds: 19, delay: 0, sway: 26, colour: "rgba(0,179,155,0.30)" },
  { left: 6, size: 14, seconds: 27, delay: 11, sway: -20, colour: "rgba(0,168,123,0.22)" },
  { left: 9, size: 18, seconds: 23, delay: 4, sway: 16, colour: "rgba(244,128,138,0.26)" },
  { left: 12, size: 11, seconds: 31, delay: 19, sway: -14, colour: "rgba(0,174,239,0.20)" },
  { left: 15, size: 22, seconds: 21, delay: 8, sway: 22, colour: "rgba(0,179,155,0.26)" },
  { left: 18, size: 13, seconds: 29, delay: 15, sway: -24, colour: "rgba(244,128,138,0.20)" },
  { left: 4, size: 19, seconds: 25, delay: 22, sway: 12, colour: "rgba(0,174,239,0.24)" },
  { left: 21, size: 16, seconds: 33, delay: 6, sway: -18, colour: "rgba(0,168,123,0.18)" },
  { left: 11, size: 24, seconds: 18, delay: 26, sway: -10, colour: "rgba(244,128,138,0.24)" },
  // Right edge.
  { left: 97, size: 23, seconds: 20, delay: 2, sway: -26, colour: "rgba(244,128,138,0.28)" },
  { left: 93, size: 15, seconds: 26, delay: 13, sway: 18, colour: "rgba(0,179,155,0.24)" },
  { left: 89, size: 20, seconds: 22, delay: 7, sway: -14, colour: "rgba(0,174,239,0.22)" },
  { left: 86, size: 12, seconds: 30, delay: 20, sway: 22, colour: "rgba(0,168,123,0.20)" },
  { left: 83, size: 25, seconds: 19, delay: 10, sway: -20, colour: "rgba(0,179,155,0.28)" },
  { left: 80, size: 14, seconds: 28, delay: 17, sway: 15, colour: "rgba(244,128,138,0.22)" },
  { left: 95, size: 17, seconds: 24, delay: 24, sway: 20, colour: "rgba(0,168,123,0.24)" },
  { left: 77, size: 18, seconds: 32, delay: 5, sway: -16, colour: "rgba(0,174,239,0.18)" },
  { left: 91, size: 21, seconds: 17, delay: 28, sway: 11, colour: "rgba(244,128,138,0.26)" },
];

export default function SocialBubbles() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {HEARTS.map((h) => (
        <span
          key={`${h.left}-${h.delay}`}
          className="absolute bottom-0 block animate-floatUp"
          style={{
            left: `${h.left}%`,
            width: h.size,
            animationDuration: `${h.seconds}s`,
            animationDelay: `-${h.delay}s`,
            // Read by the keyframes, so one keyframe covers every heart.
            ["--sway" as string]: `${h.sway}px`,
          }}
        >
          <svg viewBox="0 0 24 24" fill={h.colour} className="block h-auto w-full">
            <path d="M12 21s-7.2-4.5-9.3-8.6C1 9.2 2.6 5.5 6.1 4.8c2-.4 3.9.5 4.9 2.1h2c1-1.6 2.9-2.5 4.9-2.1 3.5.7 5.1 4.4 3.4 7.6C19.2 16.5 12 21 12 21Z" />
          </svg>
        </span>
      ))}
    </span>
  );
}
