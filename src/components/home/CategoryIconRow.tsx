import Link from "next/link";
import {
  AccessoriesIcon,
  FirstAidIcon,
  ForMenIcon,
  HairCareIcon,
  OralCareIcon,
  SkincareIcon,
  TopBrandIcon,
  WellnessIcon,
} from "@/components/icons/CategoryIcons";

// The row of nine round shortcuts directly under the hero.
//
// It replaces the packshot tiles that used to sit here. Those were photographs
// of whatever the category happened to sell best that week, so the row changed
// shape every rebuild and read as a line of pale smudges at small sizes; a
// drawn mark is the same mark every time and is legible at 44px.
//
// Four of the nine are the shop's own taxonomy (/shop/<category>). The other
// five have no category behind them and point at the Shopify collections the
// merchandisers already keep — which is also why the handles below do not
// always match their titles: `special-promotion` is the best-seller list and
// `medicine-and-first-aid` is dermatology, so neither is what it sounds like.

type Shortcut = {
  href: string;
  label: string;
  Icon?: typeof SkincareIcon;
  /** The sale disc carries a word instead of a mark, as in the design. */
  word?: string;
};

const shortcuts: Shortcut[] = [
  { href: "/collections/sale-up-to-50-off", label: "ลดราคาพิเศษ", word: "Sale" },
  { href: "/brands", label: "แบรนด์แนะนำ", Icon: TopBrandIcon },
  { href: "/shop/skincare", label: "สกินแคร์", Icon: SkincareIcon },
  { href: "/shop/oral-care", label: "ดูแลช่องปาก", Icon: OralCareIcon },
  { href: "/shop/wellness", label: "วิตามินและอาหารเสริม", Icon: WellnessIcon },
  { href: "/shop/hair-care", label: "ดูแลเส้นผม", Icon: HairCareIcon },
  { href: "/collections/for-men", label: "สำหรับผู้ชาย", Icon: ForMenIcon },
  { href: "/collections/medical-equipment", label: "อุปกรณ์เสริม", Icon: AccessoriesIcon },
  { href: "/collections/first-aid-smoothllife", label: "ปฐมพยาบาล", Icon: FirstAidIcon },
];

export default function CategoryIconRow() {
  return (
    <nav aria-label="หมวดหมู่สินค้า" className="bg-[#f8fffe]">
      {/* Nine across needs about 1200px. Below that the row scrolls rather
          than wrapping: a second line of two or three orphans is worse than a
          row that visibly continues, and the first card peeking in from the
          right is what tells a thumb there is more. */}
      <ul // The row stops scrolling and centres itself at xl, not lg. Nine
          // 100px tiles with the smallest gap the clamp allows need 1028px,
          // and at lg the page has 976 — so `lg:overflow-visible` took the
          // scrollbar away from a row that still did not fit and pushed the
          // whole page sideways instead.
          className="mx-auto flex max-w-[1512px] gap-3 overflow-x-auto scroll-smooth px-4 py-5 scrollbar-none md:gap-5 md:px-6 xl:justify-center xl:gap-[clamp(1rem,2.6vw,2.4rem)] xl:overflow-visible">
        {shortcuts.map((s) => (
          <li key={s.href} className="shrink-0">
            <Link
              href={s.href}
              // 72px on a phone against a 68px disc: the tile was 86px wide
              // and the gap 20px, which put 38px of nothing between two
              // discs — a row that read as scattered rather than as a set.
              className="group flex w-[72px] flex-col items-center gap-2.5 md:w-[86px] xl:w-[100px]"
            >
              {s.word ? (
                <span className="grid h-[68px] w-[68px] place-items-center rounded-full bg-brand-gradient bg-[length:200%_100%] text-[21px] font-semibold text-white shadow-[0_6px_16px_rgba(0,168,123,0.28)] transition-transform duration-300 animate-gradientPan group-hover:-translate-y-1 group-hover:scale-105 group-active:scale-95 lg:h-[88px] lg:w-[88px] lg:text-[27px]">
                  {s.word}
                </span>
              ) : (
                <span className="grid h-[68px] w-[68px] place-items-center rounded-full border border-slate-200/80 bg-white text-brand-1000 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-brand-200 group-hover:shadow-card group-active:scale-95 lg:h-[88px] lg:w-[88px]">
                  {s.Icon && (
                    // The disc lifts; the mark inside it bobs. Both only on
                    // hover, and the bob runs once — see iconBob.
                    <s.Icon
                      className="h-[42px] w-[42px] motion-safe:group-hover:animate-iconBob lg:h-14 lg:w-14"
                      blobClassName="text-brand-200/70"
                    />
                  )}
                </span>
              )}
              <span className="line-clamp-2 text-center text-[11px] font-medium leading-snug text-brand-ink transition-colors group-hover:text-brand-800 lg:text-[15px]">
                {s.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
