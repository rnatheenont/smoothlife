import type { ReactNode } from "react";
import SkyClouds from "@/components/SkyClouds";

// The banner at the top of the shop: what you are looking at, how much of it
// there is, and the row of categories to move between.
//
// It used to carry the category's own mark drawn large and faint on the
// right. The mark went: it said the same thing as the heading beside it, in
// a quieter voice, and the space reads better empty.
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
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  /** How many products the current filters leave, said under the heading. */
  count?: number;
  /** The category row, which belongs inside the banner rather than under it
   *  — from lg only; see where it is rendered. */
  children?: ReactNode;
}) {
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
      <div className="container-page relative py-7 md:py-10">
        <p className="text-[11px] font-medium tracking-[0.3em] text-brand-800">{eyebrow}</p>
        <h1 className="mt-1.5 text-2xl font-extrabold text-brand-1000 md:text-4xl">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-600 md:text-base">{subtitle}</p>
        {typeof count === "number" && (
          <p className="mt-2 text-sm font-semibold text-brand-800">
            {count.toLocaleString("th-TH")} รายการ
          </p>
        )}
        {/* From lg only. Below that the same row is rendered under the
            banner instead, because it pins there: it is `sticky` under the
            app bar on a phone, and a sticky element cannot escape its
            parent — this banner both ends early and clips its clouds with
            overflow-hidden, either of which would kill the pinning. */}
        {children && <div className="mt-5 hidden md:mt-6 lg:block">{children}</div>}
      </div>
    </section>
  );
}
