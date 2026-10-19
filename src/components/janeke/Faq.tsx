import { script } from "./font";
import FaqCarousel, { type FaqCard } from "./FaqCarousel";
import Reveal from "./Reveal";

/**
 * The four questions, as a deck the reader turns.
 *
 * Only the first has a photograph of its own so far. The other three stand on
 * a tint keyed to the brush each answer is about, drawn from the same cut-outs
 * the colour picker uses further up the page — which keeps them part of the
 * same set rather than looking like something missing. Swap `cutout`/`tint`
 * for an `image` as the photographs arrive.
 */
const CARDS: FaqCard[] = [
  {
    question: "HOW ARE THE FOUR STYLES DIFFERENT?",
    image: "/janeke/faq.webp",
    alt: "แปรง Janeke บนพรมแดงที่เวนิส",
    answer: (
      <>
        <strong className="font-bold text-[#685048]">Premium Superbrush</strong> offers timeless elegance,
        while <strong className="font-bold text-[#685048]">Maculata Superbrush</strong> stands out with its
        bold design. <strong className="font-bold text-[#685048]">Superbrush</strong> is your full-size
        everyday essential, and <strong className="font-bold text-[#685048]">Small Superbrush</strong> brings
        the same practical convenience in a compact, travel-friendly size.
      </>
    ),
  },
  {
    question: "CAN I USE IT ON WET HAIR?",
    cutout: "/brands/janeke/gold-brown.webp",
    alt: "แปรง Janeke Premium Superbrush สีทอง",
    tint: ["#f3ece0", "#ffffff"],
    answer: "Yes. Flexible bristles help gently detangle both wet and dry hair.",
  },
  {
    question: "WHICH BRUSH IS RIGHT FOR ME?",
    cutout: "/brands/janeke/leopard-magenta.webp",
    alt: "แปรง Janeke Mac Fux Superbrush Maculata",
    tint: ["#f6e9ef", "#ffffff"],
    answer:
      "For everyday brushing, Superbrush is a great all-rounder. Prefer something more refined? Choose Premium Superbrush. Love a statement design? Go for Mac Fux Superbrush Maculata. For on-the-go touch-ups, Small Superbrush is your perfect companion.",
  },
  {
    question: "CAN I PLACE AN ORDER ON THIS PAGE?",
    cutout: "/brands/janeke/teal-pink.webp",
    alt: "แปรง Janeke Small Superbrush Blue",
    tint: ["#e6f4f3", "#ffffff"],
    answer: "Choose your style and color, then add it to your cart.",
  },
];

export default function JanekeFaq() {
  return (
    <section className="bg-white px-4 py-14 md:py-20">
      <div className="mx-auto max-w-[1390px]">
        <Reveal>
          <h2
            className={`${script.className} text-center text-[clamp(2.25rem,7vw,5rem)] leading-tight text-[#685048]`}
          >
            FAQ
          </h2>
          <p className="mt-3 text-center text-[clamp(0.85rem,1.6vw,1.125rem)] text-[#78716f]">
            A Few Things Worth Knowing.
          </p>
        </Reveal>

        <FaqCarousel cards={CARDS} />
      </div>
    </section>
  );
}
