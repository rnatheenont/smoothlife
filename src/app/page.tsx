import Link from "next/link";
import clsx from "clsx";
import Image from "next/image";
import { ShieldCheck, Truck, Award, MessageCircle, ChevronRight, Repeat, PercentCircle } from "lucide-react";
import { products } from "@/data/products";
import { Product } from "@/data/types";
import { brands } from "@/data/brands";
import { promotions } from "@/data/promotions";
import { articles } from "@/data/articles";
import { subscriptionPlans } from "@/data/subscriptions";
import { formatTHB } from "@/lib/format";
import { heroBanners } from "@/data/heroBanners";
import { getLiveHeroBanners } from "@/lib/shopify-admin";
import { getStorefrontHeroBanners } from "@/lib/storefront-banners";
import { getStoreArticles, storeArticleHref } from "@/lib/storefront-articles";
import KnowledgeArcGallery, { type ArcItem } from "@/components/home/KnowledgeArcGallery";
import HeroCarousel from "@/components/HeroCarousel";
import CategoryIconRow from "@/components/home/CategoryIconRow";
import SmoothieHeroBand from "@/components/home/SmoothieHeroBand";
import HeroTrio from "@/components/home/HeroTrio";
import PromoStrip from "@/components/home/PromoStrip";
import ConcernCoverflow from "@/components/home/ConcernCoverflow";
import DealOfTheDayCard from "@/components/DealOfTheDayCard";
import FreeGiftPromoCard from "@/components/FreeGiftPromoCard";
import SectionHeading from "@/components/SectionHeading";
import ScrollReveal from "@/components/ScrollReveal";
import StaggerGrid from "@/components/StaggerGrid";
import ScaleReveal from "@/components/ScaleReveal";
import BrandCircleRow from "@/components/home/BrandCircleRow";
import ProductTabs from "@/components/ProductTabs";
import PromoPair from "@/components/home/PromoPair";
import SubscriptionBanner from "@/components/home/SubscriptionBanner";
import TrendingOnSocial, { SocialClip } from "@/components/TrendingOnSocial";
import { pageMetadata } from "@/lib/site-pages";

export function generateMetadata() {
  return pageMetadata("home");
}
// Re-pulls the live smoothlife.com banner slideshow at most every 30 minutes —
// so an edit made there through the Shopify theme customizer shows up here
// automatically, without a code change or redeploy on this side.
export const revalidate = 1800;

export default async function HomePage() {
  // The slides the team publishes on www.smoothlife.com, read off that page;
  // the theme-file route is the backup, the static list the last resort.
  const [storefrontBanners, liveArticles] = await Promise.all([getStorefrontHeroBanners(), getStoreArticles()]);
  const liveHeroBanners = storefrontBanners ?? (await getLiveHeroBanners());
  const bestSellers = products.filter((p) => p.inStock && p.badges?.includes("Bestseller")).slice(0, 8);
  const newArrivals = products
    .filter((p) => p.inStock && p.badges?.includes("New"))
    .concat(products.filter((p) => p.inStock).slice(0, 4))
    .slice(0, 8);
  const onSale = products.filter((p) => p.inStock && p.badges?.includes("Sale")).slice(0, 8);
  // This catalogue sync doesn't carry review/rating data (every product
  // comes through as rating 0 / reviewCount 0), so "trending" can't be
  // ranked by popularity — discount depth is the real, non-fabricated
  // signal we do have, so bigger price cuts rank first instead.
  const discountPct = (p: Product) => (p.compareAtPrice ? 1 - p.price / p.compareAtPrice : 0);
  const bundles = products
    .filter((p) => p.inStock && p.badges?.includes("Bundle"))
    .sort((a, b) => discountPct(b) - discountPct(a))
    .slice(0, 8);
  // The newest posts from the Shopify blog (see storefront-articles.ts), dated;
  // the static guides only if that feed can't be read.
  const featuredArticles: ArcItem[] = liveArticles
    ? liveArticles.slice(0, 12).map((a) => ({
        key: a.handle,
        href: storeArticleHref(a),
        title: a.title,
        image: a.image,
      }))
    : articles.slice(0, 12).map((a) => ({
        key: a.slug,
        href: `/knowledge/article/${a.slug}`,
        title: a.title,
        image: a.image as string | null,
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

      {/* The wide deal strip the design puts between the shortcuts and the
          first shelf. */}
      <PromoStrip />

      {/* Products — one tabbed section instead of four near-identical
          stacked carousels (Best Sellers / On Sale / New / Bundles), so
          browsing all of them costs one tap instead of a long scroll. */}
      <ProductTabs
        tabs={[
          { label: "ขายดี", products: bestSellers },
          { label: "ลดราคา", products: onSale },
          { label: "มาใหม่", products: newArrivals },
          { label: "เซ็ตสุดคุ้ม", products: bundles },
        ]}
      />

      {/* Trust strip — now after the first shelf of products rather than
          above it. Four promises mean nothing to somebody who has not yet
          seen anything they want; they mean a good deal to somebody who has
          just found it and is deciding whether to buy it here.
          Four promises, and each one is now a link to the page
          that explains it — a shopper who reads "คืนสินค้าได้" and wants the
          conditions had nowhere to go from here.

          No tinted pills: four identical filled boxes made the row read as
          decoration, and the fill was doing no work that a hairline between
          columns doesn't do better. The sub-line carries the condition that
          actually answers the doubt ("ไม่มียอดขั้นต่ำ") rather than restating
          the title ("ทุกออเดอร์"). */}
      <section className="border-y border-surface-line bg-white/70">
        <div className="container-page">
          <ul className="grid grid-cols-2 md:grid-cols-4">
            {[
              { icon: Truck, title: "ส่งฟรีทั่วไทย", sub: "ไม่มียอดขั้นต่ำ", href: "/help/delivery" },
              { icon: ShieldCheck, title: "ของแท้ 100%", sub: "นำเข้าตรง มี อย.", href: "/about" },
              { icon: MessageCircle, title: "ให้คำปรึกษาฟรี", sub: "ตอบโดยผู้เชี่ยวชาญ", href: "/help/contact" },
              { icon: Award, title: "คืนสินค้าได้", sub: "ภายใน 14 วัน", href: "/help/delivery" },
            ].map((f, i) => (
              <li
                key={f.title}
                className={clsx(
                  "border-surface-line",
                  // Hairlines between columns only, so the row reads as one
                  // band: every tile gets a left rule except the first in its
                  // row, and the two-column layout needs a rule under the top
                  // pair as well.
                  i % 2 === 1 && "border-l md:border-l",
                  i % 2 === 0 && "md:border-l",
                  i === 0 && "md:border-l-0",
                  i < 2 && "border-b md:border-b-0"
                )}
              >
                <Link
                  href={f.href}
                  className="flex h-full items-center gap-3 px-3 py-4 transition-colors hover:bg-surface-mist focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-teal md:justify-center md:gap-3.5 md:px-5 md:py-5"
                >
                  <f.icon size={22} strokeWidth={1.75} className="shrink-0 text-brand-emerald" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-brand-ink md:text-sm">{f.title}</span>
                    <span className="block truncate text-[11px] text-slate-500 md:text-xs">{f.sub}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Promotions, and the deals that follow it, are one block of the page
          now: campaign tiles, then the day's deal and any free-gift offer.
          Was the first section after Trust strip (filling the
          slot the mobile-only "today's deals" slider used to occupy);
          Categories now leads instead, so this follows it. */}
      <section className="py-8 md:py-16 lg:py-24">
        {/* The same Thai heading on every screen. Mobile used to get an
            English caps eyebrow in its place — shouting in the one language
            the page is not written in. */}
        <ScrollReveal className="container-page">
          <SectionHeading title="โปรโมชั่นและดีลเด็ด" subtitle="New, Best Sellers and Promotions" href="/promotions" />
        </ScrollReveal>
        {/* A rail on a phone, a grid on a desktop.
            Four tiles stacked two-by-two is a screen and a half of scrolling
            to see four things; swiping through them sideways is how every app
            on the same phone shows the same content, and it costs no height
            at all. snap-mandatory so a half-shown tile settles rather than
            hanging in the gutter. */}
        <StaggerGrid
          className="container-page flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-none md:grid md:grid-cols-4 md:gap-4 md:overflow-visible"
          stagger={0.1}
        >
          {promotions.map((promo) => (
            <Link
              key={promo.slug}
              href={`/promotions#${promo.slug}`}
              className="group relative aspect-4/3 w-[72%] shrink-0 snap-start overflow-hidden rounded-surface transition-transform active:scale-[0.98] sm:w-[45%] md:w-auto md:active:scale-100"
            >
              <Image
                src={promo.image}
                alt={promo.title}
                fill
                className="object-cover transition-transform duration-500"
              />
              {/* The banners are shot with the caption's space left clear, and that
                  space is already a deep teal — so the scrim only has to lift
                  contrast, not manufacture it. Tinted to the photographs' own
                  colour rather than black, which greyed them. */}
              <div className="absolute inset-0 bg-linear-to-t from-[#0d3436]/75 via-[#0d3436]/20 via-45% to-transparent" />
              <div className="absolute bottom-0 left-0 p-3 md:p-4 text-white">
                <span className="rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-brand-800">
                  {promo.badge}
                </span>
                <h3 className="mt-1 text-sm font-bold [text-shadow:0_1px_2px_rgb(0_0_0/0.45)] md:text-base">{promo.title}</h3>
                <p className="text-[11px] text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0/0.45)] md:text-xs">{promo.subtitle}</p>
              </div>
            </Link>
          ))}
        </StaggerGrid>
      </section>

      {/* Free-gift promos — real active promos, rendered only when the
          respective widgets are toggled on (both default off). No py here:
          each card owns its own vertical margin so a disabled/empty widget
          (the default) collapses to zero height instead of leaving a big
          blank padded gap with nothing in it. Kept right next to
          Promotions/ProductTabs since it's the same "deals" cluster. */}
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

      {/* Membership, in one place: subscribe, then the rewards and shipping
          pair right under it. Three separate pitches for the same
          relationship used to be spread across the page with other things in
          between. Committing to a
          recurring plan is a bigger ask than a one-off purchase, so it
          converts better after the catalogue, social proof, and brand story
          above have already built trust, rather than pitching it early. */}
      <section className="container-page py-8 md:py-16 lg:py-24">
        <ScaleReveal>
          <SubscriptionBanner />
        </ScaleReveal>
      </section>

      <PromoPair />

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
      <section className="py-5 md:py-8 lg:py-10 overflow-hidden">
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
