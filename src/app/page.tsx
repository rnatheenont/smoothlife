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
import { articleProductSlugs } from "@/lib/article-products";
import HeroCarousel from "@/components/HeroCarousel";
import CategoryIconRow from "@/components/home/CategoryIconRow";
import FlashSaleBar from "@/components/home/FlashSaleBar";
import FlashSaleShelf from "@/components/home/FlashSaleShelf";
import SmoothieHeroBand from "@/components/home/SmoothieHeroBand";
import HeroTrio from "@/components/home/HeroTrio";
import ConcernCoverflow from "@/components/home/ConcernCoverflow";
import DealOfTheDayCard from "@/components/DealOfTheDayCard";
import FreeGiftPromoCard from "@/components/FreeGiftPromoCard";
import SectionHeading from "@/components/SectionHeading";
import ScrollReveal from "@/components/ScrollReveal";
import BrandCircleRow from "@/components/home/BrandCircleRow";
import AuroraBackdrop from "@/components/home/AuroraBackdrop";
import TrendingOnSocial, { SocialClip } from "@/components/TrendingOnSocial";
import { pageMetadata } from "@/lib/site-pages";

export function generateMetadata() {
  return pageMetadata("home");
}
// Re-pulls the live smoothlife.com banner slideshow at most every 30 minutes —
// so an edit made there through the Shopify theme customizer shows up here
// automatically, without a code change or redeploy on this side.
export const revalidate = 1800;

/** How many products sit under a chosen article. */
const ARTICLE_SHELF = 10;

export default async function HomePage() {
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
  const featuredArticles: ArcItem[] = liveArticles
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
      }));

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
      <section className="relative bg-white">
        <h1 className="sr-only">
          Smoothlife — ของดีที่ใช้ได้จริง คัดมาให้แล้ว: สกินแคร์ อาหารเสริม ดูแลช่องปากและเส้นผม
          จากแบรนด์ที่วางขายจริงในไทย ของแท้ 100% มี อย. ส่งฟรีทั่วไทยไม่มีขั้นต่ำ และสะสมคะแนนได้ทุกการช้อป
        </h1>
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

      {/* Both draw themselves from widgets the admin edits, and render
          nothing at all until one is switched on — see WidgetsPanel. */}
      <FlashSaleBar />
      <FlashSaleShelf />


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
      <ConcernCoverflow />


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
          <BrandCircleRow brands={brands} />
        </ScrollReveal>
      </section>

      {/* Wellness / knowledge teaser — kept last: bottom-funnel content for
          people still researching rather than ready to buy or subscribe. */}
      {/* Centred story header over a drifting arc of covers, after the
          "Great talent. Easier to find." block on fastwork.co/for-business. */}
      <section className="overflow-hidden bg-white pt-10 pb-12 md:pt-16 md:pb-16 lg:pt-20">
        <ScrollReveal className="container-page text-center">
          <p className="text-[13px] font-medium tracking-[0.04em] text-slate-500">บทความและความรู้</p>
          <h2 className="mt-2 text-[26px] font-medium leading-[1.4] tracking-[-0.01em] text-[#0a0a0a] md:text-[40px]">
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
