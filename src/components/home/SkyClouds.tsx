// The sky behind the hero band.
//
// Drawn rather than photographed: a photograph of a sky is a megabyte at the
// top of every visit, cannot follow the brand's colours, and cannot loop. Each
// cloud is four overlapping circles under one blur, which is what gives it a
// soft edge without a PNG.
//
// Three rows at three speeds is what makes it read as depth rather than as a
// pattern sliding past: the small, pale, distant ones take over three minutes
// to cross, the near ones under two. Each row is two identical halves inside
// a 200%-wide track moving exactly -50%, so the loop has no seam.
//
// The blur is deliberately small relative to each cloud. A 20px blur on a
// 150px cloud is not a soft edge, it is a smudge — the first pass had them so
// soft against a pale sky that they read as a smear on the screen.
//
// Everything here is decoration: aria-hidden, pointer-events-none, and
// composited (the blur is painted once and the track is only transformed), so
// the drift costs a transform per row rather than a repaint. The site's
// reduced-motion rule stops them where they stand.

type Puff = {
  /** % across its half of the track. */
  left: number;
  /** % down the band. */
  top: number;
  /** % of the half's width. */
  width: number;
};

type Row = {
  puffs: Puff[];
  seconds: number;
  blur: number;
  opacity: number;
};

const ROWS: Row[] = [
  // Far: small, pale, barely moving.
  {
    seconds: 210,
    blur: 5,
    opacity: 0.55,
    puffs: [
      { left: 5, top: 12, width: 13 },
      { left: 30, top: 5, width: 10 },
      { left: 57, top: 16, width: 14 },
      { left: 81, top: 8, width: 11 },
    ],
  },
  // Middle.
  {
    seconds: 140,
    blur: 9,
    opacity: 0.8,
    puffs: [
      { left: 1, top: 40, width: 20 },
      { left: 37, top: 26, width: 17 },
      { left: 68, top: 46, width: 22 },
    ],
  },
  // Near: big, bright, and low, where they sit under the headline rather than
  // behind it.
  {
    seconds: 95,
    blur: 13,
    opacity: 1,
    puffs: [
      { left: 10, top: 60, width: 30 },
      { left: 58, top: 66, width: 34 },
    ],
  },
];

function Cloud({ puff }: { puff: Puff }) {
  return (
    <span
      className="absolute block"
      style={{
        left: `${puff.left}%`,
        top: `${puff.top}%`,
        width: `${puff.width}%`,
        // Clouds are about twice as wide as they are tall; the circles below
        // are placed as percentages of this box.
        aspectRatio: "2 / 1",
      }}
    >
      <span className="absolute bottom-0 left-[6%] h-[52%] w-[88%] rounded-full bg-white" />
      <span className="absolute left-0 top-[34%] h-[52%] w-[44%] rounded-full bg-white" />
      <span className="absolute left-[24%] top-0 h-[80%] w-[52%] rounded-full bg-white" />
      <span className="absolute right-[2%] top-[22%] h-[62%] w-[46%] rounded-full bg-white" />
    </span>
  );
}

export default function SkyClouds() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      {ROWS.map((row) => (
        <span
          key={row.seconds}
          className="absolute inset-y-0 left-0 flex w-[200%] animate-marquee"
          style={{
            animationDuration: `${row.seconds}s`,
            filter: `blur(${row.blur}px)`,
            opacity: row.opacity,
          }}
        >
          {[0, 1].map((half) => (
            <span key={half} className="relative block h-full w-1/2">
              {row.puffs.map((puff) => (
                <Cloud key={`${puff.left}-${puff.top}`} puff={puff} />
              ))}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
