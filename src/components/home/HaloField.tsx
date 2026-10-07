import clsx from "clsx";

// A ring of moving light around the field you talk to the AI in.
//
// The field is the one thing on the homepage that answers back, and a plain
// grey outline said nothing about that. This is three soft coloured lights
// travelling along the bottom of a box one pixel bigger than the input, with
// the input sitting opaque on top: all that escapes is the rim, so the border
// itself is what moves. Borrowed from cult-ui's halo-search, rebuilt in CSS
// (it ships as a Motion component with a shader avatar, none of which this
// field needs) and in the brand's own colours rather than its pink-purple.
//
// Light at the bottom, not all the way round. A ring lit evenly reads as a
// loading spinner; lit from below it reads as something resting on a surface,
// which is what the field is doing.
//
// Brighter on focus — the ring is the field's way of saying it is listening,
// so it should change when it starts.

type Blob = {
  /** Which rail, i.e. which of the three drift rhythms. */
  rail: string;
  /** Tailwind size + blur for the light itself. */
  light: string;
  gradient: string;
};

const BLOBS: Blob[] = [
  {
    rail: "animate-haloA",
    light: "-bottom-5 h-16 w-48 blur-xl",
    gradient: "linear-gradient(90deg,#00b39b,#00aeef,#7cc8ff,#00a87b)",
  },
  {
    rail: "animate-haloB",
    light: "-bottom-4 h-12 w-32 blur-lg",
    gradient: "linear-gradient(90deg,#f4808a,#ffc46b,#00b39b)",
  },
  {
    rail: "animate-haloC",
    light: "-bottom-3 h-10 w-24 blur-lg",
    gradient: "linear-gradient(90deg,#00aeef,#00b39b,#a6e3d7)",
  },
];

export default function HaloField({
  focused,
  children,
  className,
}: {
  focused: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // The padding is the border: the input covers everything inside it, so
    // what shows is a 1.5px ring. Grey underneath, because a ring made only
    // of travelling lights disappears wherever none of them happen to be —
    // and a field with no edge at all is worse than a still one.
    <div className={clsx("relative rounded-full bg-slate-200 p-[1.5px]", className)}>
      {/* The glow the ring throws onto the page around it. Faint, and really
          only there on focus — the ring is the field's way of saying it is
          listening, so it should change when it starts. */}
      <span
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute -inset-2 rounded-full blur-xl transition-opacity duration-300",
          focused ? "opacity-40" : "opacity-0"
        )}
        style={{ background: "linear-gradient(90deg,#00b39b,#00aeef,#f4808a,#00b39b)" }}
      />

      {/* The lights themselves, clipped to the rounded box. */}
      <span
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute inset-0 overflow-hidden rounded-full transition-opacity duration-300",
          focused ? "opacity-100" : "opacity-80"
        )}
      >
        <span className="absolute inset-x-0 bottom-0 block h-2/3">
          {BLOBS.map((b) => (
            // The rail is the width of the field and carries the drift; the
            // light inside it only has to sit still and glow.
            <span key={b.rail} className={clsx("absolute inset-0 block will-change-transform", b.rail)}>
              <span className={clsx("absolute left-0 block rounded-full", b.light)} style={{ background: b.gradient }} />
            </span>
          ))}
        </span>
      </span>

      {children}
    </div>
  );
}
