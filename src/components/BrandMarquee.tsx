import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/data/types";

// Pure CSS marquee (same animate-marquee keyframe as the header promo bar)
// split into 3 rows, alternating direction, so it reads as a logo "wall"
// rather than one long static row. No client JS needed.
function MarqueeRow({ brands, reverse }: { brands: Brand[]; reverse?: boolean }) {
  const track = [...brands, ...brands];
  return (
    <div className="overflow-hidden">
      <div
        className="flex w-max gap-3 animate-marquee"
        style={{ animationDuration: "40s", animationDirection: reverse ? "reverse" : undefined }}
      >
        {track.map((b, i) => (
          <Link
            key={`${b.slug}-${i}`}
            href={`/shop?brand=${b.slug}`}
            className="shrink-0 grid place-items-center h-16 w-28 md:h-20 md:w-36 rounded-xl border border-slate-100 bg-white hover:border-brand-teal hover:shadow-card transition-all overflow-hidden"
          >
            {b.image ? (
              <div className="relative h-full w-full scale-[1.8]">
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
