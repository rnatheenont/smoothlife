import SkyCastle from "@/components/home/SkyCastle";

// The hero band's Christmas dress: a winter night going pale towards the
// bottom, snow falling, and a skyline of snowy hills, pines and a lit cottage.
//
// Drawn like HalloweenSky and SkyClouds, for the same reasons: no photograph
// at the top of every visit, the brand's own colours, and a seamless loop.
// Decoration only: aria-hidden, pointer-events-none, transforms and opacity.

// Flakes as [left %, top % of their half-track, px]. Two halves stacked in a
// 200%-tall track moving down exactly one half, so the fall never restarts.
const FLAKES: [number, number, number][] = [
  [4, 12, 4], [11, 61, 3], [17, 33, 5], [24, 80, 3], [29, 8, 4], [36, 47, 3], [42, 71, 5],
  [48, 22, 3], [55, 56, 4], [61, 4, 3], [66, 38, 5], [72, 77, 3], [78, 18, 4], [84, 52, 3],
  [90, 30, 5], [95, 68, 3], [8, 90, 3], [52, 92, 4], [70, 95, 3], [33, 97, 4],
];

function Pine({ x, h, snow = true }: { x: number; h: number; snow?: boolean }) {
  const w = h * 0.62;
  // three stacked tiers, widest at the bottom, standing on y=172
  const tiers = [0, 1, 2].map((i) => {
    const top = 172 - h + (i * h) / 3.2;
    const half = (w / 2) * (0.55 + i * 0.25);
    const base = top + h / 2.3;
    return `M${x} ${top}L${x + half} ${base}H${x - half}Z`;
  });
  return (
    <g>
      <rect x={x - 3} y={160} width={6} height={12} fill="#2b1d17" />
      {tiers.map((d) => (
        <path key={d} d={d} fill="#14402f" />
      ))}
      {snow && <path d={`M${x} ${172 - h}l${w * 0.14} ${h * 0.12}h-${w * 0.28}Z`} fill="#f4fbff" />}
    </g>
  );
}

export default function ChristmasSky() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      {/* A star to steer by, top left, where Halloween keeps its moon. */}
      <span
        className="absolute left-[9%] top-[12%] h-3 w-3 rotate-45 bg-[#fff6d6] md:h-4 md:w-4"
        style={{ boxShadow: "0 0 26px 10px rgb(255 238 180 / 0.55)" }}
      />
      {[[22, 9], [37, 18], [49, 7], [63, 24], [74, 10], [88, 20], [95, 9]].map(([left, top]) => (
        <span
          key={`${left}-${top}`}
          className="absolute h-1 w-1 rounded-full bg-white/80 motion-safe:animate-glowPulse"
          style={{ left: `${left}%`, top: `${top}%`, animationDuration: `${2 + (left % 3)}s` }}
        />
      ))}

      <span
        className="absolute inset-x-0 top-0 block h-[200%] motion-safe:animate-snowfall"
        style={{ animationDuration: "22s" }}
      >
        {[0, 1].map((half) => (
          <span key={half} className="relative block h-1/2">
            {FLAKES.map(([left, top, size]) => (
              <span
                key={`${left}-${top}`}
                className="absolute rounded-full bg-white"
                style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, opacity: 0.55 + (size - 3) * 0.15 }}
              />
            ))}
          </span>
        ))}
      </span>

      {/* Skyline sized by width, like HalloweenSky's, so nothing is cropped on
          a wide screen. The castle stands where HalloweenSky's does: left of
          the mascot (pinned right from xl), its base sunk into the ridge. */}
      <svg viewBox="0 0 1440 180" className="absolute inset-x-0 bottom-0 w-full">
        <path fill="#cfe3f2" d="M0 128c120-18 210 8 320 6 100-2 160-20 262-18 96 2 150 20 246 20 100 0 160-22 262-22 92 0 150 16 240 16 52 0 80-4 110-8v58H0Z" />
        <SkyCastle transform="translate(872 44) scale(0.62)" wall="#22324a" roof="#1a2638" light="#ffd27a" snow flag="#c0392b" />
        <path fill="#eef6fc" d="M0 158c120-12 200 6 310 5 100-2 150-11 250-9 92 1 140 10 232 10 100 0 156-12 256-12 96 0 150 9 242 9 56 0 106-3 150-7v26H0Z" />
        <Pine x={96} h={86} />
        <Pine x={150} h={58} />
        <Pine x={330} h={44} />
        <Pine x={680} h={50} />
        <Pine x={980} h={62} />
        <Pine x={1290} h={74} />
        <Pine x={1360} h={52} />
      </svg>
    </span>
  );
}
