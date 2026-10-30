import Image from "next/image";
import SkyClouds from "@/components/SkyClouds";
import { iconThemeSrc } from "@/lib/category-icon-theme";

// The banner at the top of the shop: what you are looking at, how much of it
// there is, and the row of categories to move between.
//
// It used to carry the category's own mark drawn large and faint on the
// right, and that went: a flat line drawing of a bottle, at low contrast,
// said the same thing as the heading beside it in a quieter voice. What sits
// there now is the rendered 3D object the shortcut strip and the shop menu
// both wear — a picture rather than a watermark, at full strength, and the
// same picture the shopper followed to get here.
//
// The count and the category row moved in here. Both were below the banner —
// the row in a band of its own, and the count beside a second copy of the
// heading that the banner had already said. Three pieces of furniture for
// one idea ("you are in ดูแลช่องปาก, there are 137 of them, here is how to
// go somewhere else"), now one.

export default function ShopHero({
  eyebrow = "PRODUCTS",
  title,
  subtitle,
  count,
  categorySlug,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  /** How many products the current filters leave, said under the heading. */
  count?: number;
  /** Draws that category's 3D mark on the right. Omitted on /shop with no
   *  category chosen, where there is no one object to stand for everything. */
  categorySlug?: string;
}) {
  // Pinned to "3d" rather than following the shortcut strip's theme setting,
  // for the reason the header menu is: that setting belongs to a section, and
  // this banner is the top of a route that may carry no sections at all.
  const icon = iconThemeSrc("3d", categorySlug);

  return (
    // The same sky the home page opens with. The banner used to be a flat
    // mint wash, which said "a panel goes here" and nothing else; arriving on
    // /shop from the home page now lands under the same weather. isolate so
    // the clouds, which sit on a negative z, stay inside this box rather than
    // sliding behind the page.
    // Full-bleed: the sky is weather, and weather does not stop at a
    // 1280px card with rounded corners. The content inside still lines up
    // with the rest of the page, because the container is on the inner row.
    <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#cfe9f8_0%,#e4f3fb_52%,#f7fcfe_100%)]">
      <SkyClouds />
      <div className="container-page relative flex items-center gap-4 py-7 md:gap-8 md:py-10">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-[0.3em] text-brand-800">{eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-extrabold text-brand-1000 md:text-4xl">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-600 md:text-base">{subtitle}</p>
          {typeof count === "number" && (
            <p className="mt-2 text-sm font-semibold text-brand-800">
              {count.toLocaleString("th-TH")} รายการ
            </p>
          )}
        </div>
        {icon && (
          // 128px at the widest and no larger: the artwork is 160px on its
          // long side, so a box that fills the space this banner could spare
          // would be drawing it past its own resolution. It keeps its share
          // of the row on a phone rather than dropping out — the mark is how
          // you know at a glance which shelf you are standing in front of,
          // and that is worth more on a small screen, not less.
          <Image
            src={icon}
            alt=""
            width={160}
            height={160}
            priority
            className="size-16 shrink-0 object-contain drop-shadow-[0_8px_20px_rgba(0,53,41,0.14)] sm:size-24 md:size-28 lg:size-32"
          />
        )}
      </div>
    </section>
  );
}
