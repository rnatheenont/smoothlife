import Image from "next/image";
import SkyClouds from "@/components/SkyClouds";

// The banner at the top of the shop: what you are looking at, and how much of
// it there is, centred in the band.
//
// Behind it, when the page is a category that has one, that category's own
// wide picture; otherwise the plain sky. The two earlier attempts at making
// this band say which shelf you are on both failed the same way — a drawing
// of a bottle placed next to the word for that bottle is the heading said
// twice, and it got worse the bigger it went. A background is a different
// job: it colours the whole band rather than competing with the heading for
// the eye, so it can say "hair care" without saying it again.
//
// The pictures are drawn with their subject at the left and right edges and
// the middle third left empty — see category-banner.ts — which is where the
// heading goes. The scrim below is for the rest: cover-cropping to a band
// this wide moves things around, and it means the heading never has to hope.
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
  banner,
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
  /** The category's wide picture, from categoryBanner(). Without one the band
   *  is the sky, which is what every page that is not one category wears. */
  banner?: string | null;
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
    // The gradient stays under the picture as well as instead of it: it is
    // what the band is while the image is still arriving.
    <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#cfe9f8_0%,#e4f3fb_52%,#f7fcfe_100%)]">
      {banner ? (
        <>
          <Image
            src={banner}
            alt=""
            fill
            sizes="100vw"
            priority
            className="-z-10 object-cover"
          />
          {/* Light through the middle, clear at the edges: the heading keeps
              its contrast wherever the crop lands, and the pictures keep the
              bit of themselves they were drawn for. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_90%_at_50%_50%,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.55)_45%,rgba(255,255,255,0)_78%)]"
          />
        </>
      ) : (
        <SkyClouds />
      )}
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
