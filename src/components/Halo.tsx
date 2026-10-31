import clsx from "clsx";

// A ring of moving light around the thing you are dealing with.
//
// Three soft coloured lights drift inside a box a pixel and a half bigger
// than the thing itself, which then sits opaque on top: all that escapes is
// the rim, so the border is what moves. Borrowed from cult-ui's halo-search,
// rebuilt in CSS (it ships as a Motion component with a shader avatar, none
// of which is wanted here) and in the brand's own colours rather than its
// pink-purple.
//
// Two users, two jobs. Around the AI field the ring is always lit and gets
// brighter on focus — it is the field saying it answers back, and then that
// it is listening. Around a product card it is off until the pointer arrives,
// where it does the job the old hover shadow was doing alone: saying which
// card of forty-eight is the one under the cursor.

/** The rim, in px. Enough to carry colour; thin enough to still read as a border. */
const RIM = "1.5px";

const GRADIENTS = {
  cool: "linear-gradient(90deg,#00b39b,#00aeef,#7cc8ff,#00a87b)",
  warm: "linear-gradient(90deg,#f4808a,#ffc46b,#00b39b)",
  sky: "linear-gradient(90deg,#00aeef,#00b39b,#a6e3d7)",
  /** For the bloom thrown outside the rim, where only the hues matter. */
  full: "linear-gradient(90deg,#00b39b,#00aeef,#f4808a,#00b39b)",
};

/** The three drift rhythms. Different lengths so the ring never settles into
 *  a pattern you can follow. */
const RAILS = ["animate-haloA", "animate-haloB", "animate-haloC"] as const;

/**
 * The lights, and nothing else — the caller clips them.
 *
 * `paused` parks the animations instead of unmounting them, so a wall of
 * cards costs three stopped animations each rather than three running ones.
 * They start where they left off, which on a ring of drifting light reads as
 * the lights having been there all along.
 */
function Lights({ shape, paused }: { shape: "pill" | "chip" | "card"; paused?: boolean }) {
  // A pill is lit from below: a ring lit evenly reads as a loading spinner,
  // lit from underneath it reads as something resting on a surface. A card is
  // too tall for that to reach the top corners, so its lights are the height
  // of the card and sweep across instead.
  //
  // A chip is a pill small enough that neither of those works. Lighting the
  // bottom two thirds of a 30px pill leaves 20px for a light blurred over
  // 24px, which arrives at the rim as almost no colour at all — measured on
  // the staff button, where the ring was running the whole time and read as
  // a plain grey border. It gets the full height and a quarter of the blur.
  const field = shape === "card" ? "absolute inset-0" : shape === "chip" ? "absolute inset-0" : "absolute inset-x-0 bottom-0 h-2/3";
  // The pill widths are capped against the box as well as in px. A light
  // wider than the pill it travels along lights the whole rim at once, and a
  // rim lit all over does not read as moving — which is what happened the
  // first time this went on the staff button: 192px of light on a 160px pill
  // came out as a static wash of colour, next to an AI field 460px wide
  // where the same light plainly runs. The min() leaves the field at exactly
  // the figures it was tuned at (half of 460 is more than 192) and scales
  // the lights down for anything smaller.
  const sizes =
    shape === "chip"
      ? ["-inset-y-2 w-1/2 blur-[6px]", "-inset-y-1 w-1/3 blur-[5px]", "-inset-y-1 w-1/4 blur-[4px]"]
      : shape === "pill"
        ? [
            "-bottom-5 h-16 w-[min(12rem,50%)] blur-xl",
            "-bottom-4 h-12 w-[min(8rem,33%)] blur-lg",
            "-bottom-3 h-10 w-[min(6rem,25%)] blur-lg",
          ]
        : ["-inset-y-8 w-2/3 blur-xl", "-inset-y-6 w-1/2 blur-lg", "-inset-y-4 w-2/5 blur-lg"];
  const gradients = [GRADIENTS.cool, GRADIENTS.warm, GRADIENTS.sky];

  return (
    <span className={clsx("block", field)}>
      {RAILS.map((rail, i) => (
        // The rail is the width of the box and carries the drift; the light
        // inside it only has to sit still and glow.
        <span
          key={rail}
          className={clsx(
            "absolute inset-0 block",
            rail,
            paused && "[animation-play-state:paused] group-hover:[animation-play-state:running]"
          )}
        >
          <span
            className={clsx("absolute left-0 block rounded-full", sizes[i])}
            style={{ background: gradients[i] }}
          />
        </span>
      ))}
    </span>
  );
}

/** The AI field: a pill whose ring is always lit, brighter while focused. */
export function HaloField({
  focused,
  compact,
  children,
  className,
}: {
  focused: boolean;
  /** A pill the height of a line of text rather than of a search field. Its
   *  lights are shorter and far less blurred, because the rim of a 30px pill
   *  is too little of a window for a 24px blur to show any colour through. */
  compact?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // The padding is the border: the input covers everything inside it. Grey
    // underneath, because a ring made only of travelling lights disappears
    // wherever none of them happen to be, and a field with no edge at all is
    // worse than a still one.
    <div className={clsx("relative rounded-full bg-slate-200", className)} style={{ padding: RIM }}>
      <span
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute -inset-2 rounded-full blur-xl transition-opacity duration-300",
          focused ? "opacity-40" : "opacity-0"
        )}
        style={{ background: GRADIENTS.full }}
      />
      <span
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute inset-0 overflow-hidden rounded-full transition-opacity duration-300",
          focused || compact ? "opacity-100" : "opacity-80"
        )}
      >
        <Lights shape={compact ? "chip" : "pill"} />
      </span>
      {/* The child is positioned so that it covers the lights.
      
          Not a detail: the lights are absolutely positioned, and a positioned
          descendant paints above the in-flow content of its stacking context
          whatever the DOM order. A child that is not positioned itself ends
          up *under* them — which on the staff button meant three coloured
          blobs lying across the label. It went unseen while the lights were
          blurred 24px at 80% and confined to the bottom third, because what
          landed on the text there was a wash too faint to notice. The chip
          shape made them crisp and the bug with it.
          
          A relative block changes no layout: the input it wraps on the AI
          field is w-full either way. */}
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * A product card: a ring that is not there until the pointer is.
 *
 * Needs `group` on an ancestor — in practice the element this returns, since
 * the card puts it there. No grey underneath this one: the card already has
 * its own hairline, and a second ring around it when nothing is happening
 * would just be a thicker border.
 */
export function HaloRing({ radius }: { radius: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute -inset-1.5 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-35",
          radius
        )}
        style={{ background: GRADIENTS.full }}
      />
      <span
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          radius
        )}
      >
        <Lights shape="card" paused />
      </span>
    </>
  );
}

export { RIM };
