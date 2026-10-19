import Image from "next/image";

import { script } from "./font";
import Reveal, { RevealGroup, RevealItem } from "./Reveal";

/**
 * The closing question.
 *
 * A list of one, on purpose: the design carries a single card, and the shape
 * below takes however many entries are added to CARDS without changing — one
 * card centres, more lay out two and three across.
 */
const CARDS = [
  {
    image: "/janeke/faq.webp",
    alt: "แปรง Janeke บนพรมแดงที่เวนิส",
    question: "HOW ARE THE FOUR STYLES DIFFERENT?",
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

        <RevealGroup className="mt-10 grid justify-center gap-6 md:mt-16 md:grid-cols-[repeat(auto-fit,minmax(18rem,20rem))]">
          {CARDS.map((c) => (
            <RevealItem key={c.question}>
              <article className="overflow-hidden rounded-[1.5rem] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)] md:rounded-[2rem]">
                <Image
                  src={c.image}
                  alt={c.alt}
                  width={1080}
                  height={1350}
                  className="aspect-square w-full object-cover"
                />
                <div className="px-6 py-7 text-center md:px-10 md:py-9">
                  <h3 className="text-[clamp(0.95rem,1.4vw,1.25rem)] font-bold tracking-wide text-[#685048]">
                    {c.question}
                  </h3>
                  <p className="mt-3 text-[clamp(0.8rem,1.1vw,0.95rem)] leading-relaxed text-[#78716f]">
                    {c.answer}
                  </p>
                </div>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
