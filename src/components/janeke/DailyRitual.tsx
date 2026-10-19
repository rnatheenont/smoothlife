import Image from "next/image";

import { script } from "./font";
import Lift from "./Lift";
import Reveal from "./Reveal";

/**
 * The ritual section: a headline over the same dome the product slider
 * stands on, with one tall card on it.
 *
 * The dome is drawn rather than imported — an ellipse that wide exports as a
 * large path, and `rounded-t-full` on a box of the right ratio is the same
 * shape for none of the bytes. It sits behind the card and is cut off by the
 * section, which is what the design's boolean of an ellipse and a rectangle
 * amounts to.
 */
export default function JanekeDailyRitual() {
  return (
    <section className="relative overflow-hidden bg-white px-4 pt-14 pb-16 md:pt-20 md:pb-24">
      <Reveal>
        <h2
          className={`${script.className} text-center text-[clamp(2.25rem,7vw,5rem)] leading-tight text-[#685048]`}
        >
          Your Daily Hair Ritual
        </h2>
        <p className="mt-3 text-center text-[clamp(0.85rem,1.6vw,1.125rem)] text-[#78716f]">
          Your Everyday Essential
        </p>
      </Reveal>

      <div className="relative mt-10 md:mt-16">
        {/* The dome. 1920 × 800 in the design — the same 2.4:1 arc as the
            slider's, so the two sections read as one pair. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 mx-auto h-[calc(min(100vw,1920px)/2.4)] w-full max-w-[1920px] rounded-t-full bg-gradient-to-b from-[#f1efed] via-[#f6f5f4] to-white"
        />

        <Lift className="relative mx-auto w-[min(72vw,340px)] md:w-[min(32vw,540px)]">
          <Reveal kind="scale">
            <div className="overflow-hidden rounded-[1.5rem] shadow-[0_24px_60px_rgba(15,23,42,0.18)] md:rounded-[2rem]">
              <Image
                src="/janeke/ritual.webp"
                alt="คลิปรีวิวแปรง Janeke Superbrush หลากสี"
                width={960}
                height={1692}
                className="h-auto w-full"
              />
            </div>
          </Reveal>
        </Lift>
      </div>
    </section>
  );
}
