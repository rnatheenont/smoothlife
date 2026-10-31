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
  eyebrow: _eyebrow = "PRODUCTS",
  title,
  subtitle,
  count,
  countLabel = "รายการ",
  banner,
}: {
  /** Accepted and ignored — see the note in the heading stack. */
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
    // Curved along the bottom, square across the top: the band meets the
    // header flush and then lets the page out from under it. overflow-hidden
    // is doing two jobs now — it kept the clouds in, and it is what clips the
    // photograph to the curve.
    // Reaches up behind the bar. The bar carries no background of its own
    // until the page moves, so what sits behind it at the top of the page is
    // this band rather than a white strip — the picture starts at the very
    // top of the window and the logo and the search field sit on it.
    //
    // --app-header-top-h, not --app-header-h: the second one shrinks when the
    // bar detaches and the promo strip folds away, and a negative margin tied
    // to it would haul the whole page up by the difference on the first
    // scroll. The padding puts back exactly what the margin took, so the
    // heading sits where it would have anyway.
    <section className="relative isolate -mt-(--app-header-top-h) overflow-hidden rounded-b-[1.75rem] bg-[linear-gradient(180deg,#cfe9f8_0%,#e4f3fb_52%,#f7fcfe_100%)] pt-(--app-header-top-h) md:rounded-b-[2.5rem]">
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
          {/* The eyebrow is gone. It was "PRODUCTS" in 11px letterspaced
              capitals, with a hairline either side, over a Thai heading that
              said the same thing — English shouting a translation of the
              word underneath it, on a page whose readers are reading Thai.
              The prop stays: page_header and collection_header both pass one
              from stored documents, and dropping it from the signature would
              break them at the type level for nothing. */}
          {/* leading is set rather than inherited, and set to 1.5: Tailwind's
              text-5xl comes with 1.1 and text-2xl with 1.33, which are Latin
              figures. Thai stacks a tone mark above a vowel above the letter
              and hangs a vowel below it, and the browser reports the rendered
              line box for this face at 28px as 42px tall — exactly 1.5. At
              anything less, two lines overlap by the difference whether or
              not the particular words happen to collide. On a title that
              does not wrap this costs a few pixels of band height. */}
          <h1 className="mt-3 text-[28px] font-semibold leading-[1.5] text-brand-1000 md:mt-4 md:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-2.5 max-w-md text-sm text-slate-600 md:text-base">
              {subtitle}
            </p>
          )}
          {typeof count === "number" && (
            // A chip rather than a fourth line of centred text: it is the one
            // thing in the stack that is a fact rather than a name, and on the
            // category banners it has a photograph behind it.
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-1.5 text-[13px] text-brand-800 ring-1 ring-brand-200/70 backdrop-blur-sm md:mt-5">
              <span className="font-bold">{count.toLocaleString("th-TH")}</span>
              {countLabel}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
