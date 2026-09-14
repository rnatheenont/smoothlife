import { CONCERN_DEFS, CONCERN_KEYS, concernScore, type ConcernResults } from "@/lib/skin-analysis";

/**
 * All twelve scores on one wheel: further out is better. Rings at 25/50/75/100
 * so a spike or a dent reads at a glance; each axis names its concern and
 * score in the concern's own colour.
 */
export default function RadarChart({ concerns, previous }: { concerns: ConcernResults; previous?: ConcernResults | null }) {
  // Wider than tall: the side labels ("ความกระจ่างใส") need the room.
  const W = 440;
  const H = 350;
  const cx = W / 2;
  const cy = H / 2;
  const R = 112;
  const n = CONCERN_KEYS.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const at = (i: number, value: number) => {
    const a = angle(i);
    const r = (value / 100) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const shape = (c: ConcernResults) =>
    CONCERN_KEYS.map((k, i) => at(i, concernScore(c[k].severity)).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-md" role="img" aria-label="แผนภูมิเรดาร์คะแนนผิว 12 ด้าน">
      {[25, 50, 75, 100].map((ring) => (
        <polygon
          key={ring}
          points={CONCERN_KEYS.map((_, i) => at(i, ring).join(",")).join(" ")}
          fill={ring === 100 ? "#F4FAF8" : "none"}
          stroke="#DCE7E1"
          strokeWidth="1"
        />
      ))}
      {CONCERN_KEYS.map((_, i) => {
        const [x, y] = at(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#DCE7E1" strokeWidth="1" />;
      })}
      {previous && <polygon points={shape(previous)} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 3" />}
      <polygon points={shape(concerns)} fill="#00A87B" fillOpacity="0.22" stroke="#05755F" strokeWidth="2" strokeLinejoin="round" />
      {CONCERN_KEYS.map((k, i) => {
        const [x, y] = at(i, concernScore(concerns[k].severity));
        return <circle key={k} cx={x} cy={y} r="3" fill="#05755F" />;
      })}
      {CONCERN_KEYS.map((k, i) => {
        const a = angle(i);
        const lx = cx + (R + 14) * Math.cos(a);
        const ly = cy + (R + 22) * Math.sin(a) + (Math.sin(a) > 0.5 ? 6 : 0);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        return (
          <g key={k}>
            <text x={lx} y={ly - 6} textAnchor={anchor} fontSize="11" fill="#475569">
              {CONCERN_DEFS[k].label}
            </text>
            <text x={lx} y={ly + 9} textAnchor={anchor} fontSize="14" fontWeight="700" fill={CONCERN_DEFS[k].color}>
              {concernScore(concerns[k].severity)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
