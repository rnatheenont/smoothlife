import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/data/types";

// Nine brands in circles, the same shape language as the category row above.
//
// This replaces the scrolling logo wall, which existed because the catalogue
// carries dozens of vendors and a fixed grid either hid most of them or grew
// enormous. The design picks nine instead — so the section heading's "ดูทั้งหมด"
// link is what carries the other fifty-odd now, and it has to stay.

const FEATURED = [
  "smooth-e",
  "dentiste",
  "janeke",
  "eucerin",
  "cerave",
  "blackmores",
  "mega",
  "swisse",
  "vichy",
];

export default function BrandCircleRow({ brands }: { brands: Brand[] }) {
  // Named order first, then whatever is left over if one of them is ever
  // dropped from brands.ts — nine circles with a hole in the row is worse
  // than nine circles with a substitute in it.
  const picked = FEATURED.map((slug) => brands.find((b) => b.slug === slug)).filter(
    (b): b is Brand => Boolean(b)
  );
  const fill = brands.filter((b) => !picked.includes(b)).slice(0, FEATURED.length - picked.length);
  const row = [...picked, ...fill];

  return (
    <ul className="mx-auto flex max-w-[1512px] gap-5 overflow-x-auto px-4 py-2 scrollbar-none md:px-6 lg:justify-center lg:gap-[clamp(1rem,2.4vw,2.1rem)] lg:overflow-visible">
      {row.map((b) => (
        <li key={b.slug} className="shrink-0">
          <Link href={`/brands/${b.slug}`} className="group flex w-[96px] flex-col items-center gap-3 lg:w-[116px]">
            <span className="grid h-[88px] w-[88px] place-items-center overflow-hidden rounded-full border border-slate-200/80 bg-white transition-all duration-300 group-hover:border-brand-200 group-hover:shadow-card group-active:scale-95 lg:h-[116px] lg:w-[116px]">
              {b.image ? (
                // The logos are square collection images with their own
                // padding baked in, so the circle shows about 70% of the box
                // rather than the whole thing shrunk into the middle of it.
                <span className="relative block h-[70%] w-[70%]">
                  <Image src={b.image} alt="" fill sizes="116px" className="object-contain" />
                </span>
              ) : (
                <span translate="no" className="px-2 text-center text-xs font-semibold text-slate-600">
                  {b.name}
                </span>
              )}
            </span>
            <span
              translate="no"
              className="line-clamp-1 text-center text-[13px] font-medium text-brand-ink transition-colors group-hover:text-brand-800 lg:text-[15px]"
            >
              {b.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
