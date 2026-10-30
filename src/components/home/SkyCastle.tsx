// The castle on the hero band's skyline, shared by the seasonal skies
// (HalloweenSky, ChristmasSky, NewYearSky) so it is one drawing in three
// colourings rather than three drawings drifting apart.
//
// Drawn in its own units with the base at y=150 and the footprint between
// x≈-44 and x≈156, so a caller places it with one transform — the same
// translate/scale the first castle used, which puts its base a touch under
// the far ridge (see HalloweenSky for why that y is not free).

type Props = {
  /** translate + scale onto the 1440×180 skyline. */
  transform: string;
  wall: string;
  roof: string;
  /** The lit windows — the only warm thing on the skyline. */
  light: string;
  /** Snow on every roof and battlement. */
  snow?: boolean;
  flag?: string;
};

// x positions of the merlons along the curtain wall's top.
const MERLONS = [0, 14, 28, 82, 96];

export default function SkyCastle({ transform, wall, roof, light, snow = false, flag }: Props) {
  const cap = "#f4fbff";
  // Conical roof: base corners and apex.
  const cone = (x0: number, x1: number, y: number, apex: [number, number]) =>
    `M${x0} ${y}L${apex[0]} ${apex[1]}L${x1} ${y}Z`;
  const snowCone = (apex: [number, number], w: number) =>
    `M${apex[0]} ${apex[1]}l${w} ${w * 1.5}q${-w} ${w * 0.5} ${-w * 2} 0Z`;
  return (
    <g transform={transform}>
      {/* Curtain wall with battlements. */}
      <path fill={wall} d="M0 150V78h110v72Z" />
      {MERLONS.map((x) => (
        <rect key={x} x={x} y={68} width={9} height={12} fill={wall} />
      ))}

      {/* Left tower, its roof and battlement band. */}
      <path fill={wall} d="M-38 150V58h40v92Z" />
      <path fill={roof} d={cone(-44, 8, 60, [-18, 12])} />
      {/* Right tower, taller, with the flag. */}
      <path fill={wall} d="M108 150V48h44v102Z" />
      <path fill={roof} d={cone(102, 158, 50, [130, -4])} />
      {/* Centre keep, tallest. */}
      <path fill={wall} d="M38 150V34h34v116Z" />
      <path fill={roof} d={cone(32, 78, 36, [55, -16])} />
      {/* A small turret on the keep's shoulder, so the outline steps. */}
      <path fill={wall} d="M72 92V62h14v30Z" />
      <path fill={roof} d={cone(69, 89, 64, [79, 44])} />

      {flag && (
        <>
          <path stroke={wall} strokeWidth="2.5" d="M130-4v-20" />
          <path fill={flag} d="M131-24l17 5.5-17 5.5Z" />
          <path stroke={wall} strokeWidth="2" d="M55-16v-14" />
          <path fill={flag} d="M56-30l11 4-11 4Z" />
        </>
      )}

      {snow && (
        <g fill={cap}>
          <path d={snowCone([-18, 12], 9)} />
          <path d={snowCone([130, -4], 10)} />
          <path d={snowCone([55, -16], 9)} />
          <path d={snowCone([79, 44], 5)} />
          {MERLONS.map((x) => (
            <rect key={x} x={x - 1} y={66} width={11} height={4} rx={2} />
          ))}
          <rect x={-40} y={57} width={44} height={4} rx={2} />
          <rect x={106} y={47} width={48} height={4} rx={2} />
        </g>
      )}

      {/* The gate at the foot of the keep, lit from inside: a dark arch on a
          dark wall disappears. Drawn after the keep, which stands over it. */}
      <path fill={light} opacity="0.5" d="M45 150v-20a10 10 0 0 1 20 0v20Z" />

      {/* Arched windows. */}
      {[
        [-23, 86],
        [-23, 112],
        [50, 52],
        [50, 82],
        [123, 72],
        [123, 100],
        [12, 100],
        [88, 104],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} fill={light} d={`M${x} ${y + 14}v-9a4.5 4.5 0 0 1 9 0v9Z`} />
      ))}
    </g>
  );
}
