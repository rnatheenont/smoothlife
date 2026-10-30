// The hero band's Halloween dress: a dusk sky, a moon, bats that beat their
// wings, and a skyline of dead trees and a castle along the bottom edge.
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

/**
 * A bare tree.
 *
 * Strokes, not a filled outline. A tree at this size is its branching, and
 * branching drawn as a fill means every limb needs two edges that have to
 * stay parallel as they taper — which is how the first pass ended up
 * looking like a bottle brush. One stroke per limb, round-capped and
 * thinning as it goes out, is the same drawing with a tenth of the path.
 *
 * Grown from (0,0) at the base, upward into negative y, so a caller only
 * has to say where the ground is.
 */
function DeadTree({ x, scale, flip }: { x: number; scale: number; flip?: boolean }) {
  const ink = "#1b0f2b";
  return (
    <g
      transform={`translate(${x} 240) scale(${flip ? -scale : scale} ${scale})`}
      fill="none"
      stroke={ink}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Trunk, leaning a little: a vertical tree is a telegraph pole. */}
      <path d="M0 0C-1-26 3-48 1-72" strokeWidth="9" />
      {/* The two big limbs, out and up. */}
      <path d="M1-52C-9-58-16-68-20-82" strokeWidth="6" />
      <path d="M1-60C10-64 18-73 23-86" strokeWidth="6" />
      {/* Second pair, higher and shorter. */}
      <path d="M1-70C-5-76-9-84-11-94" strokeWidth="4.5" />
      <path d="M1-72c5-5 9-12 11-21" strokeWidth="4.5" />
      {/* Twigs: where the silhouette stops being a shape and starts being a
          tree. Thin enough that they disappear at the far scale, which is
          what distance should do to them. */}
      <path
        strokeWidth="2.2"
        d="M-20-82c-4-2-9-3-13-2M-20-82c-1-5-1-10 1-14M23-86c4-3 7-7 8-12M23-86c4 1 9 1 13-1M-11-94c-3-2-7-3-11-3M-11-94c0-4 1-8 3-11M12-93c3-2 7-3 11-3M12-93c-1-4-1-8 0-12M1-72c0-6 0-11-1-16"
      />
    </g>
  );
}

export default function HalloweenSky() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      {/* The moon, high and to the left, with a halo rather than a hard
          edge: a flat disc on a gradient reads as a sticker. */}
      <span
        className="absolute left-[8%] top-[10%] h-24 w-24 rounded-full bg-[#ffe9b8] md:h-28 md:w-28"
        style={{ boxShadow: "0 0 70px 20px rgb(255 221 150 / 0.45)" }}
      />

      {/* Stars: a fixed handful rather than a random field, so the sky is
          the same sky on every visit. */}
      {[
        [21, 8],
        [34, 20],
        [47, 6],
        [58, 28],
        [69, 13],
        [76, 31],
        [89, 18],
        [94, 8],
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

      {/* The skyline. Three depths of their own: a far ridge, the castle on
          it, and the near trees and fence. It is the band's bottom edge, so
          nothing here loops — nothing moves down here. */}
      <svg
        viewBox="0 0 1440 240"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-[120px] w-full md:h-[150px]"
      >
        {/* Far ridge, lighter: distance is haze, not a smaller shape. */}
        <path
          fill="#3a2350"
          d="M0 186c112-22 186 14 288 10 94-4 144-26 244-22 88 4 134 26 224 26 94 0 150-28 244-28 90 0 140 22 230 22 86 0 144-14 210-22v68H0Z"
        />

        {/* The castle, standing on the far ridge. Towers, battlements and
            lit windows — the windows are the only warm thing down here, and
            they are what says somebody is home. */}
        <g transform="translate(1012 46)">
          <path
            fill="#190e29"
            d="M0 150V74h18V60h14v14h16V40h16v34h18V60h14v14h18v76Z"
          />
          {/* Left tower */}
          <path fill="#190e29" d="M-34 150V62h36v88Z" />
          <path fill="#190e29" d="M-16 22-40 64h48Z" />
          {/* Right tower, taller */}
          <path fill="#190e29" d="M112 150V52h38v98Z" />
          <path fill="#190e29" d="M131 6 105 54h52Z" />
          {/* Centre keep */}
          <path fill="#190e29" d="M44 150V34h30v116Z" />
          <path fill="#190e29" d="M59 0 36 36h46Z" />
          {/* A flag, because a tower without one is a chimney. */}
          <path fill="#190e29" d="M131 6V-8m0 0 16 5-16 5" />
          <path stroke="#190e29" strokeWidth="2" d="M131 8V-10" />
          <path fill="#190e29" d="M131-10l15 4.5-15 4.5Z" />
          {[
            [-22, 88],
            [-22, 112],
            [54, 70],
            [54, 96],
            [124, 82],
            [124, 108],
            [6, 104],
            [84, 104],
          ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="8" height="12" rx="4" fill="#ffc46b" />
          ))}
        </g>

        {/* Near ground, darkest, with everything standing on it. */}
        <path
          fill="#20122f"
          d="M0 214c120-16 200 8 310 6 100-2 150-14 250-12 92 2 140 14 232 14 100 0 156-16 256-16 96 0 150 12 242 12 56 0 106-4 150-10v32H0Z"
        />
        <DeadTree x={104} scale={0.82} />
        <DeadTree x={188} scale={0.54} flip />
        <DeadTree x={356} scale={0.42} />
        <DeadTree x={690} scale={0.38} flip />
        <DeadTree x={1348} scale={0.74} flip />
        <DeadTree x={1264} scale={0.5} />

        {/* Pumpkins, sitting where the ground is lowest. */}
        {[
          [470, 226, 15],
          [512, 229, 11],
          [905, 227, 14],
          [1180, 228, 12],
        ].map(([x, y, r]) => (
          <g key={x}>
            <ellipse cx={x} cy={y} rx={r * 1.3} ry={r} fill="#e8762a" />
            <path d={`M${x - 3} ${y - r - 6}h6v8h-6Z`} fill="#2f5c32" />
          </g>
        ))}
      </svg>
    </span>
  );
}
