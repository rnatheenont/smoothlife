// The hero band's Halloween dress: a dusk sky, a moon, bats on a loop and a
// ridge of pumpkins along the bottom edge.
//
// Drawn, like the clouds it replaces, and for the same reasons — a
// photograph of a night sky is a megabyte at the top of every visit, cannot
// follow the brand's colours and cannot loop. See SkyClouds, whose track
// trick this borrows: each row is two identical halves inside a 200%-wide
// box moving exactly -50%, so the loop has no seam.
//
// Everything here is decoration: aria-hidden, pointer-events-none, and
// nothing but transforms and opacity, so the drift costs no repaints. The
// site's reduced-motion rule stops all of it where it stands.

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
    opacity: 0.35,
    bats: [
      { left: 8, top: 18, size: 18 },
      { left: 31, top: 9, size: 14 },
      { left: 62, top: 23, size: 16 },
      { left: 84, top: 12, size: 13 },
    ],
  },
  {
    seconds: 95,
    opacity: 0.55,
    bats: [
      { left: 17, top: 34, size: 26 },
      { left: 55, top: 16, size: 22 },
      { left: 78, top: 38, size: 24 },
    ],
  },
  {
    seconds: 62,
    opacity: 0.75,
    bats: [
      { left: 38, top: 44, size: 36 },
      { left: 88, top: 28, size: 32 },
    ],
  },
];

/** One bat, wings down, as a single path — small enough that a second one
 *  for a wing-flap would cost more than it is worth at this size. */
function BatShape({ bat }: { bat: Bat }) {
  return (
    <svg
      viewBox="0 0 64 28"
      width={bat.size}
      height={(bat.size * 28) / 64}
      className="absolute motion-safe:animate-floatSlow"
      style={{
        left: `${bat.left}%`,
        top: `${bat.top}%`,
        // Each bat bobs on its own clock, so the row never pulses together.
        animationDuration: `${3 + (bat.size % 5)}s`,
      }}
    >
      <path
        fill="currentColor"
        d="M32 6c2.6 0 4.2 2.1 4.9 4.3 2-3.3 5.2-6.4 9.4-7.6 3.6-1 7.5-.4 10.6 1.6-2.4.5-3.9 2-4.6 4-.8 2.4-.4 5 .6 7.4-2.8-1.4-6-1.6-8.7-.2-2.3 1.2-3.9 3.3-5.3 5.5-1.7 2.7-3.9 5-6.9 5s-5.2-2.3-6.9-5c-1.4-2.2-3-4.3-5.3-5.5-2.7-1.4-5.9-1.2-8.7.2 1-2.4 1.4-5 .6-7.4-.7-2-2.2-3.5-4.6-4 3.1-2 7-2.6 10.6-1.6 4.2 1.2 7.4 4.3 9.4 7.6C27.8 8.1 29.4 6 32 6Z"
      />
    </svg>
  );
}

export default function HalloweenSky() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      {/* The moon, high and to the left, with a halo rather than a hard
          edge: a flat disc on a gradient reads as a sticker. */}
      <span
        className="absolute left-[8%] top-[12%] h-24 w-24 rounded-full bg-[#ffe9b8] md:h-28 md:w-28"
        style={{ boxShadow: "0 0 60px 18px rgb(255 221 150 / 0.45)" }}
      />

      {/* Stars: a fixed handful rather than a random field, so the sky is
          the same sky on every visit. */}
      {[
        [21, 8],
        [34, 22],
        [47, 6],
        [58, 30],
        [69, 14],
        [76, 33],
        [89, 20],
        [94, 9],
      ].map(([left, top]) => (
        <span
          key={`${left}-${top}`}
          className="absolute h-1 w-1 rounded-full bg-white/80 motion-safe:animate-glowPulse"
          style={{ left: `${left}%`, top: `${top}%`, animationDuration: `${2 + (left % 3)}s` }}
        />
      ))}

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

      {/* The ground: a silhouette ridge with pumpkins sitting on it, drawn
          once across the full width. It is the band's bottom edge, so it
          needs no loop — nothing moves down here. */}
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[70px] w-full md:h-[90px]"
      >
        <path
          fill="#2a1a3e"
          d="M0 78c90-14 150 10 232 8 76-2 116-20 196-18 70 2 108 20 180 20 76 0 120-22 196-22 72 0 112 18 184 18 78 0 124-18 196-16 56 2 110 12 156 20v32H0Z"
        />
        {[
          [120, 86, 15],
          [470, 84, 18],
          [905, 87, 14],
          [1255, 85, 17],
        ].map(([x, y, r]) => (
          <g key={x} fill="#f0822e">
            <ellipse cx={x} cy={y} rx={r * 1.25} ry={r} />
            <rect x={x - 2} y={y - r - 5} width="4" height="7" fill="#3c6b3a" rx="1.5" />
          </g>
        ))}
      </svg>
    </span>
  );
}
