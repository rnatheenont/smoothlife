import SkyBackdrop from "@/components/home/SkyBackdrop";

// The hero band's Halloween dress: a painted dusk scene (moon, castle on its
// hill, bare trees, jack-o'-lanterns — see SkyBackdrop) with bats beating
// their wings across it.
//
// The bats are drawn, on SkyClouds' track trick: each row is two identical
// halves inside a 200%-wide box moving exactly -50%, so the loop has no seam.
// Decoration only: aria-hidden, pointer-events-none, transforms and opacity,
// and the site's reduced-motion rule stops it where it stands.

type Bat = {
  /** % across its half of the track. */
  left: number;
  /** % down the band. */
  top: number;
  /** px across. */
  size: number;
};

type Row = { bats: Bat[]; seconds: number; opacity: number };

// Three depths, three speeds. The far ones are small and slow enough to read
// as distance rather than as the same bat drawn twice.
const ROWS: Row[] = [
  {
    seconds: 150,
    opacity: 0.4,
    bats: [
      { left: 8, top: 16, size: 20 },
      { left: 31, top: 8, size: 15 },
      { left: 62, top: 22, size: 17 },
      { left: 84, top: 11, size: 14 },
    ],
  },
  {
    seconds: 95,
    opacity: 0.62,
    bats: [
      { left: 17, top: 32, size: 30 },
      { left: 55, top: 14, size: 25 },
      { left: 78, top: 36, size: 27 },
    ],
  },
  {
    seconds: 62,
    opacity: 0.85,
    bats: [
      { left: 38, top: 42, size: 42 },
      { left: 88, top: 26, size: 36 },
    ],
  },
];

/**
 * One bat: a body and two wings that beat.
 *
 * Three shapes rather than one, because a wing that does not move is a
 * silhouette of a bat and not a bat. Each wing turns about where it meets
 * the body — transform-box: fill-box is what makes a percentage origin mean
 * the shape's own box rather than the whole SVG's.
 */
function BatShape({ bat }: { bat: Bat }) {
  const wing = { transformBox: "fill-box", transformOrigin: "100% 60%" } as const;
  return (
    <svg
      viewBox="0 0 64 30"
      width={bat.size}
      height={(bat.size * 30) / 64}
      className="absolute motion-safe:animate-floatSlow"
      style={{
        left: `${bat.left}%`,
        top: `${bat.top}%`,
        // Each bat bobs and beats on its own clock, so the row never pulses
        // together.
        animationDuration: `${3 + (bat.size % 5)}s`,
      }}
    >
      {/* Body: head with two ears, tapering to a tail. */}
      <path
        fill="currentColor"
        d="M32 9.5c1.1 0 2 .7 2.5 1.7l1.6-2.6.5 3c.6.7 1 1.6 1 2.6 0 2.4-1.7 6.4-3 8.6-.8 1.4-1.4 2.2-2.6 2.2s-1.8-.8-2.6-2.2c-1.3-2.2-3-6.2-3-8.6 0-1 .4-1.9 1-2.6l.5-3 1.6 2.6c.5-1 1.4-1.7 2.5-1.7Z"
      />
      {/* Wings: a scalloped trailing edge, which is the one line that makes
          the shape read as a bat and not as a bird. */}
      <path
        fill="currentColor"
        style={wing}
        className="motion-safe:animate-batWingL"
        d="M28.5 12.3C25.6 7.4 20.4 3.3 14.2 2.1 9.1 1.1 3.8 2.2 0 5c3.3.1 5.6 1.6 6.7 3.9 1.2 2.6 1 6-.1 9.3 3-2.1 6.4-2.9 9.3-1.6 2 .9 3.4 2.6 4.6 4.5 1 1.6 2 3.1 3.6 3.6-.4-2.3.6-4.2 2.2-5.4 1.5-1.1 3.3-1.6 4.9-1.7-1.8-1.3-2.7-3.3-2.7-5.3Z"
      />
      <path
        fill="currentColor"
        style={{ ...wing, transformOrigin: "0% 60%" }}
        className="motion-safe:animate-batWingR"
        d="M35.5 12.3c2.9-4.9 8.1-9 14.3-10.2C54.9 1.1 60.2 2.2 64 5c-3.3.1-5.6 1.6-6.7 3.9-1.2 2.6-1 6 .1 9.3-3-2.1-6.4-2.9-9.3-1.6-2 .9-3.4 2.6-4.6 4.5-1 1.6-2 3.1-3.6 3.6.4-2.3-.6-4.2-2.2-5.4-1.5-1.1-3.3-1.6-4.9-1.7 1.8-1.3 2.7-3.3 2.7-5.3Z"
      />
    </svg>
  );
}

export default function HalloweenSky() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      <SkyBackdrop name="halloween" position="28% 35%" />
      {ROWS.map((row) => (
        <span
          key={row.seconds}
          className="absolute inset-y-0 left-0 flex w-[200%] text-[#1d1030] motion-safe:animate-marquee"
          style={{ animationDuration: `${row.seconds}s`, opacity: row.opacity }}
        >
          {[0, 1].map((half) => (
            <span key={half} className="relative block h-full w-1/2">
              {row.bats.map((bat) => (
                <BatShape key={`${bat.left}-${bat.top}`} bat={bat} />
              ))}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
