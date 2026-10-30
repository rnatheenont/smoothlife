import SkyBackdrop from "@/components/home/SkyBackdrop";

// The hero band's New Year dress: a painted night over a toy city with
// fireworks on the left (see SkyBackdrop), and a couple of live bursts on the
// open right side so the sky keeps going off. Each burst grows from its
// centre and fades on its own clock. Decoration only.

type Burst = { left: number; top: number; size: number; color: string; delay: number; seconds: number };

const BURSTS: Burst[] = [
  { left: 70, top: 8, size: 110, color: "#ffd166", delay: 0.4, seconds: 4.2 },
  { left: 84, top: 4, size: 84, color: "#ff8fb1", delay: 2.1, seconds: 4.8 },
  { left: 60, top: 22, size: 64, color: "#7be0d6", delay: 3.3, seconds: 4.4 },
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
      <SkyBackdrop name="newyear" />
      {BURSTS.map((b) => (
        <span
          key={`${b.left}-${b.top}`}
          className="absolute block opacity-0 motion-safe:animate-fireworkBurst"
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
    </span>
  );
}
