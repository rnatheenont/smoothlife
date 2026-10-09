import SkyClouds from "@/components/SkyClouds";
import { CATEGORY_ICON } from "@/components/icons/CategoryIcons";

// The banner at the top of the shop: what you are looking at, and — once a
// category is chosen — that category's own mark, drawn large and faint on the
// right.
//
// The right side used to hold three promise cards (genuine goods, 1–3 day
// delivery, 14-day returns). They answered "why buy here" on every category
// in the same words, which is a job for the page footer and the help pages
// that already carry the policy, not for the one piece of furniture that
// should tell you where you are.

export default function ShopHero({
  eyebrow = "PRODUCTS",
  title,
  subtitle,
  categorySlug,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  /** The category being browsed, when one is. Picks the mark on the right. */
  categorySlug?: string;
}) {
  const Mark = categorySlug ? CATEGORY_ICON[categorySlug] : undefined;
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
      <div className="container-page relative flex items-center gap-4 py-7 md:py-10">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-[0.3em] text-brand-800">{eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-extrabold text-brand-1000 md:text-4xl">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-600 md:text-base">{subtitle}</p>
        </div>

        {/* Decoration, so aria-hidden and no label: the heading beside it
            already names the category, and a screen reader does not need to
            hear it twice. Faint enough to read as part of the sky rather than
            a control someone might try to press — hence pointer-events-none
            too. Smaller on a phone, where the heading has to wrap inside what
            is left of 343px. */}
        {Mark && (
          <Mark
            key={categorySlug}
            aria-hidden="true"
            className="pointer-events-none h-20 w-20 shrink-0 animate-fadeUp text-brand-800/20 sm:h-32 sm:w-32 md:h-44 md:w-44"
            blobClassName="text-brand-400/25"
          />
        )}
      </div>
    </section>
  );
}
