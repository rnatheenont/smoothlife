import Image from "next/image";
import Link from "next/link";

import { script } from "./font";
import Lift from "./Lift";
import Reveal, { RevealGroup, RevealItem } from "./Reveal";

/**
 * The opening of the Janeke landing page: a claim, two badges, a paragraph,
 * a round "explore" button, and under them a photo wall.
 *
 * The photo wall is one composition at a fixed 1600×1920 ratio, not a layout
 * that reflows. Every piece inside it is placed as a percentage of that box
 * and sized in `cqw` (see the `@container` below), so the whole thing scales
 * as one picture from a phone to a wide screen and nothing drifts out of
 * place at a width nobody tested. The handwritten notes are the exception:
 * a share of the width that reads well at 1600px is unreadable at 375px, so
 * they take a larger share of a narrow container and ease back to the
 * design's own size as it widens. They do not wrap at any width — the boxes
 * the design gives them are narrower than the words on a phone, and a note
 * that breaks after "Light" reads as broken rather than small.
 *
 * The grey frame with nine windows in it is the design's own shape, exported
 * from Figma as `frame.svg` — a rectangle with nine holes punched through.
 * Rebuilding it from divs would mean four bars and an outer border that have
 * to meet exactly; the file already is the shape, and the model behind simply
 * shows through the holes.
 *
 * The three prints are exported whole, paper and photograph and caption in
 * one file, rather than assembled here from a texture and a cut-out. The
 * assembled version put the wrong photograph in the middle print — a brush
 * seen whole, where the note beside it is about the vents in its head — and
 * no amount of positioning makes a composite match a design that was never
 * built that way. Each file carries its own tilt, so none is rotated here.
 */

/**
 * Each note is anchored by the centre of the text box the design draws
 * around it, not its left edge: on a phone the words are wider than that box
 * and, anchored left, they grew rightwards only — which ran "Let Your Hair"
 * out past the edge of the picture.
 *
 * `--nx`/`--ny` are that centre, and they stay on the design's own figures as
 * far down as the words will allow, because this is one picture and it should
 * read the same shape at every size.
 *
 * What does not scale with the picture is the type: the script has to stay
 * legible, so on a narrow screen it is a bigger share of the frame than the
 * design drew — the lines come out around a third wider there. That is enough
 * to make two of them foul the squiggles, which are drawn at a fixed share of
 * the frame and so shrink away underneath them. Measured on a 390px screen:
 * "Your Hand" ran into the squiggle below it, and "Less Tugging" into the one
 * on its left.
 *
 * So the two that foul move, and only as far as the words need: the top note
 * rises until it clears the squiggle under it, and the right-hand one keeps
 * the design's height and is left where the design has it. Everything else is
 * the design's own position at every width.
 */
const NOTES = [
  {
    text: ["Light On", "Your Hand"],
    // Up by 2.4, which is what it takes for the taller line to finish above
    // the squiggle that starts at 15.3%.
    place: "[--nx:47.8%] [--ny:7.6%] @2xl:[--ny:10%]",
    delay: 0.1,
  },
  {
    text: ["Let Your Hair", "Breath"],
    // Beside her, where the design has it. It hangs lower than the design's
    // own figure by the extra height of the bigger type, which is the one
    // place there is room for it to go.
    place: "[--nx:86.2%] [--ny:68.9%] @2xl:[--ny:67.1%]",
    delay: 0.2,
  },
  {
    text: ["Less Tugging", "More Moving"],
    // The design's height at every width. Only the centre moves, and only by
    // 2.1, to keep the wider line clear of the squiggle on its left.
    place: "[--nx:44%] [--ny:89.8%] @2xl:[--nx:41.9%]",
    delay: 0.3,
  },
];

// Height as well as width, and not by accident: an arrow given only a width
// falls back to its file's own proportions, and the first set exported came
// out at proportions the design never uses — the middle one drew as a giant
// vertical squiggle down the side of the picture.
const ARROWS = [
  { src: "/janeke/arrow-1.svg", left: "28.4%", top: "15.3%", width: "12.7%", height: "6.7%", delay: 0.2 },
  { src: "/janeke/arrow-2.svg", left: "85.5%", top: "58.8%", width: "11.2%", height: "8.4%", delay: 0.3 },
  { src: "/janeke/arrow-3.svg", left: "25.5%", top: "88%", width: "7.1%", height: "4.3%", delay: 0.4 },
];

const PRINTS = [
  {
    src: "/janeke/polaroid-1.webp",
    alt: "แปรง Janeke Superbrush สีทอง",
    w: 620,
    h: 799,
    delay: 0.05,
    lift: 46,
    phase: 0,
    style: { left: "0.6%", top: "1.6%", width: "35.3%" },
  },
  {
    src: "/janeke/polaroid-2.webp",
    alt: "ลายช่องระบายอากาศบนหัวแปรง Janeke",
    w: 520,
    h: 667,
    delay: 0.15,
    lift: 34,
    phase: 1.8,
    style: { left: "70.7%", top: "34.8%", width: "26.8%" },
  },
  {
    src: "/janeke/polaroid-3.webp",
    alt: "แปรง Janeke กับเส้นผม",
    w: 560,
    h: 693,
    delay: 0.25,
    lift: 26,
    phase: 3.6,
    style: { left: "1%", top: "69%", width: "29.2%" },
  },
];

export default function JanekeHero() {
  return (
    <section className="bg-white px-4 pt-8 pb-6 md:pt-16">
      <div className="mx-auto max-w-[1600px]">
        <RevealGroup className="mx-auto flex max-w-[872px] flex-col items-center gap-5 text-center md:gap-10 lg:gap-12">
          <RevealItem>
            <h1 className="flex flex-col items-center text-[#685048]">
              <span className={`${script.className} text-[clamp(2.25rem,8vw,5rem)] leading-tight`}>
                Your Hair
              </span>
              <span className="-mt-[0.1em] text-[clamp(0.95rem,3.2vw,2rem)] leading-normal text-[#78716f]">
                deserves more than
              </span>
              <span className={`${script.className} text-[clamp(2.75rem,11vw,7.5rem)] leading-tight`}>
                Just a Brush
              </span>
            </h1>
          </RevealItem>

          <RevealItem className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            {["Everyday Luxury", "Italian Beauty"].map((b) => (
              <span
                key={b}
                className="rounded-full border border-[#78716f] px-4 py-1.5 text-[clamp(0.75rem,1.6vw,1rem)] text-[#78716f] md:px-6 md:py-2"
              >
                {b}
              </span>
            ))}
          </RevealItem>

          <RevealItem>
            <p className="max-w-[575px] text-[clamp(0.9rem,2.2vw,1.5rem)] leading-relaxed text-[#78716f]">
              Meet Jäneke 1830. Iconic Italian brushes designed to bring a little luxury to your everyday
              hair routine.
            </p>
          </RevealItem>

          <RevealItem>
            <Link
              href="#collection"
              className="group grid size-[clamp(8rem,28vw,14rem)] place-items-center rounded-full border border-[#78716f] text-center text-[clamp(0.65rem,1.6vw,1.125rem)] leading-relaxed text-[#78716f] transition-colors hover:border-[#685048] hover:text-[#685048]"
            >
              <span>
                EXPLORE
                <br />
                THE COLLECTION
                <br />
                <span
                  aria-hidden="true"
                  className="mt-2 inline-block text-[1.6em] leading-none transition-transform duration-500 group-hover:translate-y-1"
                >
                  ↓
                </span>
              </span>
            </Link>
          </RevealItem>
        </RevealGroup>

        {/* The photo wall */}
        <div className="@container relative mt-8 aspect-[1600/1920] w-full md:mt-16">
          {/* The model sits behind the frame and shows through its windows. */}
          <div className="absolute inset-0 overflow-hidden">
            <Reveal
              kind="scale"
              className="absolute"
              style={{ left: "23.4%", top: "17%", width: "53.3%", height: "64.7%" }}
            >
              <Image
                src="/janeke/model.webp"
                alt="ผู้หญิงผมยาวหันหลัง หลังหวีด้วยแปรง Janeke"
                width={896}
                height={1200}
                preload
                className="size-full object-cover"
              />
            </Reveal>
          </div>

          {/* The grey frame with nine windows punched through it. */}
          <Image
            src="/janeke/frame.svg"
            alt=""
            width={1600}
            height={1920}
            className="pointer-events-none absolute inset-0 size-full"
          />

          {PRINTS.map((p) => (
            // Three transforms, three elements: where the print sits, how far
            // it drifts, and how it arrives. On one node the last would win.
            <div key={p.src} className="absolute" style={p.style}>
              <Lift distance={p.lift} phase={p.phase}>
                <Reveal kind="scale" delay={p.delay}>
                  <Image src={p.src} alt={p.alt} width={p.w} height={p.h} className="h-auto w-full" />
                </Reveal>
              </Lift>
            </div>
          ))}

          <Reveal delay={0.1} className="absolute" style={{ left: "70.6%", top: "11.8%", width: "21.8%" }}>
            <Image src="/janeke/logo.webp" alt="Jäneke 1830" width={640} height={291} className="h-auto w-full" />
          </Reveal>

          {ARROWS.map((a) => (
            <Reveal
              key={a.src}
              delay={a.delay}
              className="absolute"
              style={{ left: a.left, top: a.top, width: a.width, height: a.height }}
            >
              <Image src={a.src} alt="" width={200} height={160} className="size-full" />
            </Reveal>
          ))}

          {NOTES.map((n) => (
            // The centring sits out here, on a box with a real size, and the
            // entrance goes inside it. A zero-width wrapper is invisible to
            // the observer that triggers the entrance, so the note never
            // arrived and sat 28px off where it belonged; and had the two
            // been on one element, the entrance's transform would have
            // overwritten the centring anyway.
            <div
              key={n.text.join()}
              className={`absolute left-[var(--nx)] top-[var(--ny)] w-max -translate-x-1/2 ${n.place}`}
            >
              <Reveal delay={n.delay}>
                <p
                  className={`${script.className} whitespace-nowrap text-center text-[2.9cqw] leading-[1.5] text-[#8a7265] @md:text-[2.75cqw] @2xl:text-[2.6cqw] @4xl:text-[2.1cqw]`}
                >
                  {n.text[0]}
                  <br />
                  {n.text[1]}
                </p>
              </Reveal>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
