import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/data/types";

// Pure CSS marquee (same animate-marquee keyframe as the header promo bar)
// split into 3 rows, alternating direction, so it reads as a logo "wall"
// rather than one long static row. No client JS needed.
function MarqueeRow({ brands, reverse }: { brands: Brand[]; reverse?: boolean }) {
  // Repeat the row's brands enough times that a single "half" (before the
  // loop-closing duplicate) is comfortably wider than any real desktop
  // viewport — with only 5 unique logos per row at ~150px each, doubling
  // alone made a ~1500px track that ran out on wide screens, leaving a
  // dead gap of blank space for most of the animation cycle. Now that the
  // catalogue carries dozens of real brands (see brands.ts) each row is
  // already much longer, so the repeat count scales back down instead of
  // multiplying an already-wide row into thousands of DOM nodes.
  const REPEATS = Math.max(2, Math.ceil(40 / brands.length));
  const half = Array.from({ length: REPEATS }, () => brands).flat();
  const track = [...half, ...half];
  return (
    <div className="overflow-hidden">
      <div
        className="flex w-max gap-3 animate-marquee"
        style={{ animationDuration: "120s", animationDirection: reverse ? "reverse" : undefined }}
      >
        {track.map((b, i) => (
          <Link
            key={`${b.slug}-${i}`}
            href={`/shop?brand=${b.slug}`}
            className="shrink-0 grid place-items-center h-16 w-28 md:h-20 md:w-36 rounded-xl border border-slate-100 bg-white hover:border-brand-teal hover:shadow-card transition-all overflow-hidden"
          >
            {b.image ? (
              <div className="relative h-full w-full scale-[1.5]">
                <Image src={b.image} alt={b.name} fill className="object-contain" sizes="144px" />
              </div>
            ) : (
              <span className="text-base font-medium text-slate-600">{b.name}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function BrandMarquee({ brands }: { brands: Brand[] }) {
  const perRow = Math.ceil(brands.length / 3);
  const rows = [brands.slice(0, perRow), brands.slice(perRow, perRow * 2), brands.slice(perRow * 2)].filter(
    (r) => r.length > 0
  );

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <MarqueeRow key={i} brands={row} reverse={i % 2 === 1} />
      ))}
    </div>
  );
}
