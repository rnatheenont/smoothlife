import { script } from "./font";
import FaqCarousel, { type FaqCard } from "./FaqCarousel";
import Reveal from "./Reveal";

/** The four questions, as a deck the reader turns. */
const CARDS: FaqCard[] = [
  {
    question: "HOW ARE THE FOUR STYLES DIFFERENT?",
    image: "/janeke/faq-1.webp",
    alt: "แปรง Janeke สีเงินบนพรมแดงที่เวนิส",
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
    image: "/janeke/faq-2.webp",
    alt: "หวีผมด้วยแปรง Janeke Superbrush Gold",
    answer: "Yes. Flexible bristles help gently detangle both wet and dry hair.",
  },
  {
    question: "WHICH BRUSH IS RIGHT FOR ME?",
    image: "/janeke/faq-3.webp",
    alt: "แปรง Janeke สีขาววางบนโต๊ะข้างเตียง",
    answer:
      "For everyday brushing, Superbrush is a great all-rounder. Prefer something more refined? Choose Premium Superbrush. Love a statement design? Go for Mac Fux Superbrush Maculata. For on-the-go touch-ups, Small Superbrush is your perfect companion.",
  },
  {
    question: "CAN I PLACE AN ORDER ON THIS PAGE?",
    image: "/janeke/faq-4.webp",
    alt: "หวีผมบลอนด์ด้วยแปรง Janeke สีขาว",
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
