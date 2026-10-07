// A slow wash of brand colour behind a section.
//
// Three soft discs, each the size of a quarter of the screen, drifting on
// their own clock. Nothing in here has an edge: the blur is wide enough that
// what reaches the eye is a tint moving across the band rather than three
// shapes moving across it, which is the difference between atmosphere and
// decoration sliding past.
//
// Cheap to run. The blur is painted once per disc and only the transform
// animates, so each one is a composited layer rather than a repaint — and
// the site's reduced-motion rule parks them where they are.
//
// aria-hidden and pointer-events-none: it is a colour, not content.

type Blob = {
  /** % of the band. */
  left: number;
  top: number;
  size: number;
  colour: string;
  seconds: number;
  reverse?: boolean;
};

const BLOBS: Blob[] = [
  { left: -12, top: -30, size: 58, colour: "rgba(0,179,155,0.30)", seconds: 34 },
  { left: 52, top: -22, size: 64, colour: "rgba(0,174,239,0.26)", seconds: 46, reverse: true },
  { left: 18, top: 30, size: 54, colour: "rgba(0,168,123,0.22)", seconds: 58 },
];

export default function AuroraBackdrop() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {BLOBS.map((b) => (
        <span
          key={b.colour}
          className="absolute block rounded-full animate-driftSlow"
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: `${b.size}%`,
            // Round, not oval, whatever shape the band is.
            aspectRatio: "1 / 1",
            background: `radial-gradient(closest-side, ${b.colour}, transparent)`,
            filter: "blur(60px)",
            animationDuration: `${b.seconds}s`,
            animationDirection: b.reverse ? "reverse" : undefined,
          }}
        />
      ))}
    </span>
  );
}
