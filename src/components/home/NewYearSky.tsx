import SkyCastle from "@/components/home/SkyCastle";

// The hero band's New Year dress: a night sky with fireworks over the
// castle on its ridge (SkyCastle), windows lit.
//
// Drawn like HalloweenSky and SkyClouds, for the same reasons. Each burst is
// one SVG of rays that grows from its centre and fades on its own clock, so
// the sky never flashes all at once. Decoration only.

type Burst = { left: number; top: number; size: number; color: string; delay: number; seconds: number };

const BURSTS: Burst[] = [
  { left: 12, top: 14, size: 168, color: "#ffd166", delay: 0, seconds: 3.6 },
  { left: 30, top: 6, size: 112, color: "#ff8fb1", delay: 1.4, seconds: 4.1 },
  { left: 47, top: 18, size: 90, color: "#7be0d6", delay: 2.6, seconds: 3.8 },
  { left: 64, top: 8, size: 134, color: "#ffd166", delay: 0.9, seconds: 4.4 },
  { left: 22, top: 30, size: 78, color: "#b9a6ff", delay: 3.1, seconds: 3.9 },
  { left: 56, top: 32, size: 101, color: "#ff8fb1", delay: 1.9, seconds: 4.6 },
];

function Rays({ color }: { color: string }) {
  return (
    <svg viewBox="-50 -50 100 100" className="h-full w-full">
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const x1 = Math.cos(a) * 14, y1 = Math.sin(a) * 14, x2 = Math.cos(a) * 44, y2 = Math.sin(a) * 44;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2.4" strokeLinecap="round" />
            <circle cx={x2} cy={y2} r="2.6" fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

export default function NewYearSky() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      {[[18, 22], [38, 12], [52, 4], [71, 20], [83, 6], [92, 16]].map(([left, top]) => (
        <span
          key={`${left}-${top}`}
          className="absolute h-1 w-1 rounded-full bg-white/70 motion-safe:animate-glowPulse"
          style={{ left: `${left}%`, top: `${top}%`, animationDuration: `${2 + (left % 3)}s` }}
        />
      ))}

      {BURSTS.map((b) => (
        <span
          key={`${b.left}-${b.top}`}
          className="absolute block opacity-0 motion-safe:animate-fireworkBurst motion-reduce:opacity-70"
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: b.size,
            height: b.size,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.seconds}s`,
          }}
        >
          <Rays color={b.color} />
        </span>
      ))}

      {/* The same ridge and castle as the other seasons, lit for the night. */}
      <svg viewBox="0 0 1440 180" className="absolute inset-x-0 bottom-0 w-full">
        <path
          fill="#2a2152"
          d="M0 132c112-16 186 10 288 7 94-3 144-19 244-16 88 3 134 19 224 19 94 0 150-20 244-20 90 0 140 16 230 16 86 0 144-10 210-16v58H0Z"
        />
        <SkyCastle transform="translate(872 44) scale(0.62)" wall="#161233" roof="#110e29" light="#ffd27a" flag="#ffd166" />
        <path
          fill="#120f2b"
          d="M0 158c120-12 200 6 310 5 100-2 150-11 250-9 92 1 140 10 232 10 100 0 156-12 256-12 96 0 150 9 242 9 56 0 106-3 150-7v26H0Z"
        />
      </svg>
    </span>
  );
}
