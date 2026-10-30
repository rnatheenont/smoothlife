// The hero band's New Year dress: a night sky with fireworks over a city
// skyline with its windows lit.
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

// Buildings as [x, width, height] on a 1440×180 ground line at y=180.
const TOWERS: [number, number, number][] = [
  [0, 70, 70], [62, 46, 104], [104, 60, 82], [160, 38, 126], [196, 72, 92], [270, 54, 66],
  [320, 40, 112], [358, 66, 78], [420, 50, 96], [466, 80, 60], [540, 44, 118], [580, 70, 86],
  [646, 52, 70], [694, 40, 132], [730, 76, 90], [800, 58, 74], [852, 46, 108], [894, 72, 84],
  [960, 50, 64], [1006, 42, 120], [1044, 70, 88], [1110, 56, 72], [1160, 44, 104],
  [1200, 74, 80], [1270, 48, 116], [1314, 66, 76], [1376, 64, 96],
];

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

      <svg viewBox="0 0 1440 180" className="absolute inset-x-0 bottom-0 w-full">
        {TOWERS.map(([x, w, h]) => (
          <g key={x}>
            <rect x={x} y={180 - h} width={w} height={h} fill="#161233" />
            {Array.from({ length: Math.floor((h - 16) / 20) }, (_, row) =>
              Array.from({ length: Math.floor((w - 10) / 16) }, (_, col) =>
                // a fixed scatter of lit windows, not every one
                (x + row * 7 + col * 3) % 5 < 2 ? (
                  <rect key={`${row}-${col}`} x={x + 8 + col * 16} y={180 - h + 10 + row * 20} width="7" height="9" rx="1.5" fill="#ffd27a" opacity="0.85" />
                ) : null
              )
            )}
          </g>
        ))}
      </svg>
    </span>
  );
}
