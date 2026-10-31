import Link from "next/link";
import { ChevronRight, Repeat, PercentCircle } from "lucide-react";
import { products } from "@/data/products";
import { brands } from "@/data/brands";
import { articles } from "@/data/articles";
import { formatTHB } from "@/lib/format";
import { heroBanners } from "@/data/heroBanners";
import { getLiveHeroBanners } from "@/lib/shopify-admin";
import { getStorefrontHeroBanners } from "@/lib/storefront-banners";
import { getStoreArticles, storeArticleHref } from "@/lib/storefront-articles";
import KnowledgeArcGallery, { type ArcItem } from "@/components/home/KnowledgeArcGallery";
import { concerns } from "@/data/categories";
import { articleProductSlugs, cardsForSlugs, brandShelves, concernShelves } from "@/lib/article-products";
import HeroCarousel from "@/components/HeroCarousel";
import CategoryIconRow from "@/components/home/CategoryIconRow";
import SmoothieHeroBand from "@/components/home/SmoothieHeroBand";
import HeroTrio from "@/components/home/HeroTrio";
import ConcernCoverflow from "@/components/home/ConcernCoverflow";
import DealOfTheDayCard from "@/components/DealOfTheDayCard";
import FreeGiftPromoCard from "@/components/FreeGiftPromoCard";
import SectionHeading from "@/components/SectionHeading";
import ScrollReveal from "@/components/ScrollReveal";
import BrandCircleRow from "@/components/home/BrandCircleRow";
import { FEATURED_BRANDS } from "@/data/featured-brands";
import AuroraBackdrop from "@/components/home/AuroraBackdrop";
import TrendingOnSocial, { SocialClip } from "@/components/TrendingOnSocial";
import { pageMetadata } from "@/lib/site-pages";
import { PAGES_HOME_ENABLED } from "@/lib/feature-flags";
import { renderSections } from "@/lib/pages/render";
import { publishedDoc } from "@/lib/pages/store";
import { defaultHomeDoc } from "@/lib/pages/default-docs/home";
import { DEFAULT_LOCALE } from "@/lib/i18n/localized";

export function generateMetadata() {
  return pageMetadata("home");
}
// Re-pulls the live smoothlife.com banner slideshow at most every 30 minutes —
// so an edit made there through the Shopify theme customizer shows up here
// automatically, without a code change or redeploy on this side.
export const revalidate = 1800;

/** How many products sit under a chosen article. */
const ARTICLE_SHELF = 10;

/* The page's h1 used to be here: a sr-only paragraph of keywords at the root
   of the document, written when the hero's own line was an h2 and the page
   had no visible heading at all.
   
   The hero band carries a real h1 now, and the sentence under it says in
   plain Thai what this shop sells, where the hidden one was saying it to
   nobody. Two h1s is worse than either alone — the first one in the document
   is the one a crawler and this project's own design inspector take as the
   title, and that was the invisible one.
   
   The cost is that the heading now lives in a section an admin can remove.
   If smoothie_ask ever comes off the home document, the page's h1 goes with
   it and the heading has to move to whatever opens the page instead. */

/**
 * The home page, assembled from the document the team edits.
 *
 * Three layers deep on purpose: the published document if there is one, the
 * document built into the code if there is not, and the hand-written page
 * below if the flag is off. The middle layer is what makes the first one safe
 * to turn on — losing Supabase costs the shop its latest edits, not its home
 * page.
 */
async function StoredHomePage() {
  const doc = (await publishedDoc("home", "home")) ?? defaultHomeDoc();
  const sections = await renderSections(doc, {
    kind: "home",
    slug: "home",
    now: new Date(),
        locale: DEFAULT_LOCALE,
    isPreview: false,
  });
  return (
    // The site's own ground, not a yellow-cream of its own. #FAFAF8 was the
    // one page on the site that did not sit on --color-surface-page, and
    // against the white sections on it the difference read as a tint rather
    // than as a step.
    <div className="bg-surface-page">
      {sections}
    </div>
  );
}

export default async function HomePage() {
  if (PAGES_HOME_ENABLED) return <StoredHomePage />;
  return <LegacyHomePage />;
}

async function LegacyHomePage() {
  // The slides the team publishes on www.smoothlife.com, read off that page;
  // the theme-file route is the backup, the static list the last resort.
  const [storefrontBanners, liveArticles] = await Promise.all([getStorefrontHeroBanners(), getStoreArticles()]);
  const liveHeroBanners = storefrontBanners ?? (await getLiveHeroBanners());
  // The newest posts from the Shopify blog (see storefront-articles.ts), dated;
  // the static guides only if that feed can't be read.
  // The shelf under each cover is the catalogue of whichever brand the post
  // talks about, read out of its own writing — see lib/article-products. Done
  // here, on the server, because it reads the whole post body and only the
  // handful of resulting slugs need to cross into the browser.
  // The post that opens first carries its shelf; the rest carry slugs and
  // are fetched when the arc is turned to them (see KnowledgeArcGallery).
  const withFirstShelf = (items: ArcItem[]): ArcItem[] => {
    const first = items.findIndex((i) => i.productSlugs.length > 0);
    if (first < 0) return items;
    return items.map((item, i) =>
      i === first ? { ...item, products: cardsForSlugs(item.productSlugs) } : item
    );
  };

  const featuredArticles: ArcItem[] = withFirstShelf(liveArticles
    ? liveArticles.slice(0, 12).map((a) => ({
        key: a.handle,
        href: storeArticleHref(a),
        title: a.title,
        image: a.image,
        productSlugs: articleProductSlugs(`${a.title} ${a.excerpt} ${a.html}`, ARTICLE_SHELF),
      }))
    : articles.slice(0, 12).map((a) => ({
        key: a.slug,
        href: `/knowledge/article/${a.slug}`,
        title: a.title,
        image: a.image as string | null,
        productSlugs: articleProductSlugs(
          `${a.title} ${a.excerpt} ${a.body.join(" ")}`,
          ARTICLE_SHELF
        ),
      })));

  // Real product-video clips (Firework CDN, provided directly — not scraped).
  // (A second clip, untitled/Thai-named, was pulled — its Firework CDN
  // link returns 403, source needs to re-export it.)
  const socialClipSlugs: (string | null)[] = [
    "dentiste-anticavity-max-fluoride-toothpaste",
    "smooth-e-sun-asta-white-spot-clear",
    "sme-retinal-plus-deep-wrinkle-repair-30-g",
    "dentiste-repaire-rex3-70g",
    "smooth-e-anti-hair-loss-hair-thickening-shampoo",
    "smooth-e-babyface-hydration-foam",
    "smooth-e-white-babyface-spot-clear",
  ];
  const socialClipVideos = [
    "https://cdn6.fireworktv.com/medias/2025/11/27/1764238313-wfckresm/transcoded/720/KRU20AOM20Formalab.mp4",
    "https://cdn4.fireworktv.com/medias/2025/10/16/1760607737-gyoksnwq/transcoded/720/ASTA20Whi2030ml.mp4",
    "https://cdn4.fireworktv.com/medias/2025/10/16/1760608144-edpsbonv/transcoded/720/Serum2030ml.mp4",
    "https://cdn1.fireworktv.com/medias/2025/10/24/1761300428-djtmelvp/transcoded/720/chaladgin.mp4",
    "https://cdn1.fireworktv.com/medias/2025/10/17/1760681861-jxlvtwfn/transcoded/720/Hair20W201.mp4",
    "https://cdn7.fireworktv.com/medias/2025/10/16/1760608081-pwsygcbo/transcoded/720/Foam20Hya201.mp4",
    "https://cdn3.fireworktv.com/medias/2025/10/16/1760608006-pzikfjsq/watermarked/720/Foam20AHA.mp4",
  ];
  const socialClips: SocialClip[] = socialClipVideos.map((video, i) => ({
    video,
    product: socialClipSlugs[i] ? products.find((p) => p.slug === socialClipSlugs[i]) : undefined,
  }));

  return (
    // One canvas, not a stack of bands.
    //
    // Every section used to paint its own background — white, pale green,
    // white, pale green — which meant the page had eleven equally loud
    // announcements and no way to tell which of them mattered. The colour
    // now belongs to the page, and only the two sections that are genuinely
    // a change of subject (membership, and the reading at the end) break out
    // of it. The same components look considerably more expensive for it.
    <div className="bg-[#FAFAF8]">
      {/* Hero — the campaign artwork, edge to edge, and nothing beside it.
          This was a half-width card with the shop's claim in a column next to
          it. The banners are full-width creatives that already carry their own
          headline, dates and product shot, so a second headline set beside one
          was two voices saying different things in the same breath — and the
          artwork was rendered at under half the width it was drawn for.
          The words are not lost: the promises row below ("ส่งฟรีทั่วไทย",
          "ของแท้ 100%", "ให้คำปรึกษาฟรี") makes the same three claims with
          links behind them, and the h1 stays for search engines and screen
          readers, which by then were the only readers it still worked for. */}
      {/* The pad under the banners is the section's, not the category
          row's: the row carries its own tint full-bleed, so space added
          there would be a taller band of colour rather than air.
          
          None of it on a phone: the pagination dots are 44px tall there so
          a thumb can hit them, and that row is already all the separation
          the banners need. */}
      <section className="relative bg-white lg:pb-12">
        {/* No sr-only h1 ahead of the band — see the note where it used to
            be defined. The band's own heading is the page's h1. */}
        <SmoothieHeroBand />
        {/* Three across on a wide screen, one full-bleed slide on a phone —
            two components rather than one with a mode, see HeroTrio. */}
        <HeroTrio banners={liveHeroBanners ?? heroBanners} />
        <div className="lg:hidden">
          <HeroCarousel banners={liveHeroBanners ?? heroBanners} />
        </div>
      </section>

      {/* The nine round shortcuts from the design, standing in for both
          the mobile packshot strip and the desktop tile grid that used to
          follow it. Full-bleed: it carries its own tint. */}
      <CategoryIconRow />

      {/* The flash-sale bar and the shelf under it both belong to an event
          now: sections in the library, dragged onto whichever page the event
          runs on, rather than fixtures of the home page waiting to be
          filled. The bar left a dead countdown on the home page for the
          eighteen days after the sale it was announcing had ended. */}


      {/* Free-gift promos — real active promos, rendered only when the
          respective widgets are toggled on (both default off). No py here:
          each card owns its own vertical margin so a disabled/empty widget
          (the default) collapses to zero height instead of leaving a big
          blank padded gap with nothing in it. */}
      <section className="container-page">
        <DealOfTheDayCard />
      </section>
      <section className="container-page">
        <FreeGiftPromoCard />
      </section>

      {/* Shop by concern — the other way in, for somebody who knows what is
          bothering them but not what to buy for it. After the deals because
          browsing by problem is slower than being shown a price. */}
      <ConcernCoverflow byConcern={concernShelves(10, [concerns[0].slug])} />


      {/* What other people say — kept near the end, where it answers "is
          this shop any good" for whoever is still reading. Video
          engagement content works better once someone has already seen
          what's for sale, as a "see it in action" follow-up rather than a
          detour before they've even reached the product grid. Real
          product-video clips (Firework CDN), each linking through to the
          real product it shows. */}
      <TrendingOnSocial clips={socialClips} initialIndex={socialClipSlugs.indexOf("dentiste-repaire-rex3-70g")} />

      {/* Brands, then the reading: the two things that say who we are rather
          than what to buy today, closing the page together.
          Nine circles rather than the scrolling logo wall that was here. The
          wall existed so that none of the dozens of real vendors in
          brands.ts were hidden; with nine on show, the heading's "ดูทั้งหมด"
          link into /brands is the only route to the rest, so it stays. */}
      <section className="relative isolate overflow-hidden bg-[#f6fcfb] py-5 md:py-8 lg:py-10">
        <AuroraBackdrop />
        <ScrollReveal className="container-page">
          <SectionHeading title="แบรนด์ที่คุณไว้วางใจ" subtitle="Brands" href="/brands" />
        </ScrollReveal>
        <ScrollReveal>
          <BrandCircleRow brands={brands} shelves={brandShelves(FEATURED_BRANDS.slice(0, 1), 10)} />
        </ScrollReveal>
      </section>

      {/* Wellness / knowledge teaser — kept last: bottom-funnel content for
          people still researching rather than ready to buy or subscribe. */}
      {/* Centred story header over a drifting arc of covers, after the
          "Great talent. Easier to find." block on fastwork.co/for-business. */}
      <section className="overflow-hidden bg-white pt-10 pb-12 md:pt-16 md:pb-16 lg:pt-20">
        <ScrollReveal className="container-page text-center">
          {/* No label over the heading: it said "articles and knowledge"
              above a heading that says "knowledge about skin and health".
              The standfirst under the heading is where that belongs. */}
          <h2 className="text-[26px] font-medium leading-[1.4] tracking-[-0.01em] text-[#0a0a0a] md:text-[40px]">
            {/* Brand gradient on the site's own face. inline-block with
                padding: a clipped gradient stops at the box, and Thai tone
                marks and vowels above/below reach past it. */}
            <span className="inline-block bg-brand-gradient bg-clip-text px-0.5 pb-1 font-bold text-transparent">
              ความรู้
            </span>{" "}
            เรื่องผิวและสุขภาพ
          </h2>
          {/* Thai has no spaces between words, so the browser may break mid-
              phrase; each phrase is kept whole and the line breaks between them. */}
          <p className="mx-auto mt-2 max-w-[28rem] text-sm leading-relaxed text-slate-500 md:text-base">
            <span className="inline-block">อ่านเรื่องผิว ฟัน และสุขภาพแบบเข้าใจง่าย</span>{" "}
            <span className="inline-block">เลือกเรื่องที่สนใจ แล้วนำไปใช้ได้จริงในทุกวัน</span>
          </p>
        </ScrollReveal>
        <div className="mt-4 md:mt-8">
          <KnowledgeArcGallery items={featuredArticles} />
        </div>
        <div className="mt-2 flex justify-center">
          <Link
            href="/knowledge"
            className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[#0a0a0a] px-6 text-sm font-semibold text-white transition-colors hover:bg-black/80"
          >
            ดูบทความทั้งหมด <ChevronRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
