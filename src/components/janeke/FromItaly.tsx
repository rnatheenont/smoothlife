import Image from "next/image";

import { script } from "./font";
import Reveal from "./Reveal";

/**
 * The heritage note: two brushes in the middle, a line of copy above them to
 * the right and another below to the left.
 *
 * The design places all four pieces at absolute coordinates on a 1920×1750
 * board. Rebuilt here as a three-column grid instead — the middle column
 * holds the brushes, the outer two hold the copy, and on a narrow screen the
 * same markup stacks into one column in reading order. Holding the absolute
 * version would have meant a second copy of the markup for phones.
 */
export default function JanekeFromItaly() {
  return (
    <section className="relative overflow-hidden bg-white px-4 py-14 md:py-20">
      {/* The pale band the design runs behind the headline. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-[#f6f5f4]" />

      <div className="relative mx-auto max-w-[1440px]">
        <Reveal>
          <h2
            className={`${script.className} text-center text-[clamp(2.5rem,8vw,6rem)] leading-[1.15] text-[#685048]`}
          >
            From Italy,
            <br />
            With love.
          </h2>
        </Reveal>

        <div className="mt-10 grid items-center gap-8 md:mt-16 md:grid-cols-[1fr_auto_1fr] md:gap-6 lg:gap-10">
          {/* Reading order on a phone puts this second line last; on a wide
              screen it belongs bottom-left, where the design has it. */}
          <Reveal kind="left" className="md:order-1 md:self-end md:pb-12 lg:pb-20">
            <p className="max-w-[350px] text-center text-[clamp(0.85rem,1.5vw,1.125rem)] leading-relaxed text-[#78716f] md:ml-auto md:text-right">
              Nearly two centuries of heritage, made for your everyday.
            </p>
          </Reveal>

          <Reveal kind="scale" delay={0.1} className="md:order-2">
            <div className="flex items-end justify-center gap-2 md:gap-4">
              <Image
                src="/janeke/comb-side.webp"
                alt="หวี Janeke ด้านข้าง"
                width={330}
                height={1669}
                className="h-[clamp(11rem,30vw,25rem)] w-auto object-contain"
              />
              <Image
                src="/janeke/brush-black.webp"
                alt="แปรง Janeke Superbrush สีดำ"
                width={602}
                height={1434}
                className="h-[clamp(13rem,36vw,30rem)] w-auto object-contain"
              />
            </div>
          </Reveal>

          <Reveal kind="right" delay={0.2} className="md:order-3 md:self-start md:pt-12 lg:pt-20">
            <p className="max-w-[466px] text-center text-[clamp(0.85rem,1.5vw,1.125rem)] leading-relaxed text-[#78716f] md:text-left">
              Since 1830, Jäneke has blended Italian craftsmanship with timeless design.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 text-center text-[clamp(0.8rem,1.2vw,1.125rem)] text-[#8a7265] md:mt-16">
            Exclusively at Smoothlife.com
          </p>
        </Reveal>
      </div>
    </section>
  );
}
