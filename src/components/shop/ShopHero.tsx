import Image from "next/image";
import SkyClouds from "@/components/SkyClouds";
import { iconThemeSrc, iconThemeSrcLarge } from "@/lib/category-icon-theme";

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
  // The 4x copy, because this is the one place that draws it big — see
  // iconThemeSrcLarge. iconThemeSrc is what says whether there is art at
  // all, and the large file exists for exactly the same keys.
  const icon = iconThemeSrcLarge("3d", categorySlug);

  return (
    // The same sky the home page opens with. The banner used to be a flat
    // mint wash, which said "a panel goes here" and nothing else; arriving on
    // /shop from the home page now lands under the same weather. isolate so
    // the clouds, which sit on a negative z, stay inside this box rather than
    // sliding behind the page.
    // Full-bleed: the sky is weather, and weather does not stop at a
    // 1280px card with rounded corners. The content inside still lines up
    // with the rest of the page, because the container is on the inner row.
    // No overflow-hidden on the band, so the mark can hang out of the bottom
    // of it. The clouds do not need it — SkyClouds clips itself — and it was
    // the only thing here that did.
    <section className="relative isolate bg-[linear-gradient(180deg,#cfe9f8_0%,#e4f3fb_52%,#f7fcfe_100%)]">
      <SkyClouds />
      <div
        className={`container-page relative ${
          // A bigger object needs a deeper band to come out of: at the sizes
          // below, the banner's own height would put the top of the mark up
          // in the nav bar.
          icon ? "py-10 md:py-[4.5rem]" : "py-7 md:py-10"
        }`}
      >
        {/* The heading gives the mark its side of the band rather than
            running under it: the mark is out of flow, so nothing else
            reserves the space for it. */}
        <div
          className={
            icon
              ? "max-w-[calc(100%-10rem)] sm:max-w-[calc(100%-14.5rem)] md:max-w-[calc(100%-18rem)] lg:max-w-[calc(100%-22rem)]"
              : undefined
          }
        >
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
          // Sat on the bottom edge of the band and pushed a fifth of its own
          // height past it, so the object breaks the frame instead of sitting
          // politely inside it. end is the gutter rather than 0 because these
          // offsets resolve against the padding box, and the container's
          // gutter is padding — at 0 the mark would hang off the page edge
          // while every heading on the site stops short of it.
          //
          // pointer-events-none for the part that now covers the breadcrumb
          // row: it is a picture, and a picture should not take a click away
          // from the link underneath it.
          //
          // It keeps its share of the band on a phone rather than dropping
          // out at a breakpoint — the mark is how you know at a glance which
          // shelf you are in front of, and that is worth more on a small
          // screen, not less.
          <Image
            src={icon}
            alt=""
            width={640}
            height={640}
            priority
            className="pointer-events-none absolute bottom-0 end-[var(--page-gutter)] z-10 w-36 translate-y-[18%] object-contain drop-shadow-[0_18px_36px_rgba(0,53,41,0.20)] sm:w-52 md:w-64 lg:w-80"
          />
        )}
      </div>
    </section>
  );
}
