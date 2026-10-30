import SkyClouds from "@/components/SkyClouds";

// The banner at the top of the shop: what you are looking at, and how much of
// it there is, centred in the band.
//
// The right half has been tried twice now and is staying empty. First the
// category's own mark drawn large and faint, then the rendered 3D object at
// full size breaking out of the bottom edge; both put a picture of a bottle
// next to the word for that bottle, which is the heading said twice. Centred,
// the band has one thing in it and the sky either side of it.
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
  countLabel = "รายการ",
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  /** How many products the current filters leave, said under the heading. */
  count?: number;
  /** What the count counts. The banner is on pages that list collections and
   *  promotions as well as products, and "12 รายการ" for twelve collections
   *  is the wrong noun. */
  countLabel?: string;
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
      <div className="container-page relative py-8 md:py-12">
        {/* Capped and centred rather than centred across the whole container:
            a line of Thai running the width of a 1280px page is one the eye
            loses its place in on the way back, and the longer the measure the
            worse a centred ragged edge reads. */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium tracking-[0.3em] text-brand-800">{eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-extrabold text-brand-1000 md:text-4xl">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-600 md:text-base">{subtitle}</p>
          {typeof count === "number" && (
            <p className="mt-2 text-sm font-semibold text-brand-800">
              {count.toLocaleString("th-TH")} {countLabel}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
