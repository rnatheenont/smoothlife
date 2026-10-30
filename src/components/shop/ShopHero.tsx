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
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  /** How many products the current filters leave, said under the heading. */
  count?: number;
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
    <section className="relative isolate flex min-h-[250px] items-start overflow-hidden bg-[linear-gradient(180deg,#cfe9f8_0%,#e4f3fb_52%,#f7fcfe_100%)] sm:min-h-[220px] sm:items-center md:min-h-[240px] lg:min-h-[280px]">
      <SkyClouds />

      {/* The shelf, standing in that sky.
          
          Contained and never `cover`: the artwork is 2.5:1 and this band is
          nearer 8:1 on a laptop, so covering it would slice a horizontal
          strip out of the middle of every bottle.
          
          Two placements, because a phone cannot hold both halves side by
          side. 375px of screen split into words and a shelf leaves about
          140px for each, and 140px of Thai heading is two words a line. So
          below `sm` the shelf goes under the words, full width; from `sm`
          it moves to the right where the artwork's own empty sky was drawn
          for it, and a mask fades that sky into the gradient behind so the
          two skies meet without a seam.
          
          The box carries the artwork's own 5:2 so the mask lands on the
          picture and not beside it: given a percentage width instead, the
          box was wider than the contained image on a 1600px screen and the
          fade ran out before it reached the image's left edge, which then
          showed as a seam down the sky.
          
          A CSS background and not next/image: images.unoptimized is on, so
          next/image here would be the same 113 KB file with a layout box
          around it and no srcset to show for it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-[url('/shop/hero-products.webp')] bg-contain bg-bottom bg-no-repeat sm:hidden"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden aspect-[5/2] bg-[url('/shop/hero-products.webp')] bg-contain bg-right-bottom bg-no-repeat sm:block"
        style={{
          maskImage: "linear-gradient(to right, transparent 0%, #000 26%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 26%)",
        }}
      />

      {/* The words keep their own half. The padding is what stops a long
          category name from running in under the bottles — nothing else
          here knows how wide the artwork ended up. */}
      <div className="container-page relative w-full py-6 sm:py-10 sm:pr-[46%] lg:pr-[48%]">
        <p className="text-[11px] font-medium tracking-[0.3em] text-brand-800">{eyebrow}</p>
        <h1 className="mt-1.5 text-2xl font-extrabold text-brand-1000 md:text-4xl">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-600 md:text-base">{subtitle}</p>
        {typeof count === "number" && (
          <p className="mt-2 text-sm font-semibold text-brand-800">
            {count.toLocaleString("th-TH")} รายการ
          </p>
        )}
      </div>
    </section>
  );
}
