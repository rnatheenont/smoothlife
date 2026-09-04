import Link from "next/link";
import Image from "next/image";
import { Sparkles, ShieldCheck, Truck, Award, MessageCircle, Clock, ChevronRight, Repeat, PercentCircle } from "lucide-react";
import { products } from "@/data/products";
import { Product } from "@/data/types";
import { categories, concerns, concernImage } from "@/data/categories";
import { brands } from "@/data/brands";
import { promotions, promotionImage } from "@/data/promotions";
import { articles } from "@/data/articles";
import { subscriptionPlans } from "@/data/subscriptions";
import { formatTHB } from "@/lib/format";
import { heroBanners } from "@/data/heroBanners";
import { getLiveHeroBanners } from "@/lib/shopify-admin";
import HeroCarousel from "@/components/HeroCarousel";
import DealOfTheDayCard from "@/components/DealOfTheDayCard";
import FreeGiftPromoCard from "@/components/FreeGiftPromoCard";
import SectionHeading from "@/components/SectionHeading";
import ScrollReveal from "@/components/ScrollReveal";
import StaggerReveal from "@/components/StaggerReveal";
import StaggerGrid from "@/components/StaggerGrid";
import ScaleReveal from "@/components/ScaleReveal";
import BrandMarquee from "@/components/BrandMarquee";
import ProductTabs from "@/components/ProductTabs";
import TrendingOnSocial, { SocialClip } from "@/components/TrendingOnSocial";
import { Button } from "@/components/ui";

export const metadata = { alternates: { canonical: "/" } };
// Re-pulls the live smoothlife.com banner slideshow at most once an hour —
// so an edit made there through the Shopify theme customizer shows up here
// automatically, without a code change or redeploy on this side.
export const revalidate = 3600;

const articleCategoryLabel: Record<string, string> = {
  guide: "คู่มือ",
  ingredient: "ส่วนผสม",
  routine: "รูทีน",
  qa: "ถาม-ตอบ",
  video: "วิดีโอ",
};

export default async function HomePage() {
  const liveHeroBanners = await getLiveHeroBanners();
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
  const featuredArticles = articles.slice(0, 3);
  const usedPromoSlugs = new Set<string>();

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
    <div>
      {/* Hero — no separate AI-advisor CTA section further down: this is
          the only place that CTA ("น้อง Smoothie แนะนำ") appears,
          a second one later would be pure redundancy. */}
      <section className="relative overflow-hidden bg-white">
        {/* Mobile: plain white, no tint — desktop keeps the old short top
            banner + two floating blobs since its section is much taller
            (headline column) and reads fine with the wash. */}
        <div className="pointer-events-none hidden md:block absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-teal/10 via-brand-sky/5 to-transparent" />
        <div className="pointer-events-none hidden md:block absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-teal/10 blur-3xl animate-floatSlow" />
        <div className="pointer-events-none hidden md:block absolute -right-16 top-1/3 h-72 w-72 rounded-full bg-brand-sky/10 blur-3xl animate-floatSlow" />

        <div className="container-page relative pt-2 pb-6 md:py-24 grid md:grid-cols-[0.65fr_1.35fr] gap-8 md:gap-12 items-center">
          <StaggerReveal className="hidden md:block order-3 md:order-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-emerald shadow-card mb-5 border border-slate-100">
              <Sparkles size={13} /> แนะนำน้อง Smoothie ผู้ช่วยคนใหม่
            </span>
            <h1 className="text-4xl md:text-3xl lg:text-4xl xl:text-5xl font-extrabold !leading-[1.35] tracking-tight text-brand-ink">
              สุขภาพดี ผิวสวย <br />
              <span className="brand-text-gradient">ครบทุก Lifestyle</span> <span className="whitespace-nowrap">ที่เดียว</span>
            </h1>
            <p className="mt-5 text-slate-500 max-w-md leading-relaxed">
              ค้นหาสินค้าง่าย ซื้อเร็ว เข้าสู่ระบบด้วย OTP หรือ LINE พร้อมรับคะแนนสะสมทุกการช้อป
              ของแท้ 100% มีอย. จัดส่งฟรีทั่วไทย
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                href="/shop"
                size="none"
                className="group gap-1.5 px-7 py-3.5 text-sm shadow-cardHover hover:-translate-y-0.5 hover:shadow-xl"
              >
                เริ่มช้อปเลย
                <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Button>
              <Link
                href="/advisor"
                className="rounded-full bg-white border border-slate-200 text-brand-ink font-semibold px-7 py-3.5 text-sm hover:border-brand-teal hover:-translate-y-0.5 transition-all"
              >
                น้อง Smoothie แนะนำ
              </Link>
            </div>
          </StaggerReveal>
          <div className="relative order-1 md:order-2">
            <div className="pointer-events-none hidden md:block absolute -inset-6 rounded-[2rem] bg-brand-gradient opacity-30 blur-2xl" />
            <HeroCarousel banners={liveHeroBanners ?? heroBanners} />
          </div>

          {/* Mobile-only quick category grid — a fast-access shortcut into
              the same real categories the Categories section below lists in
              full, not a separate/fake taxonomy. Icon-circle grid (real
              category photos, not illustrations we don't have) instead of
              text tabs. Sits right under the banner, above the headline. */}
          <StaggerReveal className="order-2 md:hidden grid grid-cols-3 gap-y-4">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/shop/${c.slug}`}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <span className="relative h-[72px] w-[72px] rounded-full overflow-hidden bg-surface-soft border border-slate-100 shadow-card">
                  <Image src={c.image} alt={c.name} fill className="object-cover" />
                </span>
                <span className="text-xs font-medium text-slate-600 text-center line-clamp-1">{c.nameTh}</span>
              </Link>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* Trust strip — hidden on mobile */}
      <section className="hidden md:block border-y border-slate-100 bg-white">
        <div className="container-page py-4 md:py-5">
          <div className="flex md:grid md:grid-cols-4 gap-5 md:gap-4 overflow-x-auto scrollbar-none text-xs md:text-sm">
            {[
              { icon: ShieldCheck, label: "ของแท้ 100% มีอย." },
              { icon: Truck, label: "ส่งฟรีทั่วไทย ทุกออเดอร์" },
              { icon: Award, label: "สะสมคะแนนทุกออเดอร์" },
              { icon: MessageCircle, label: "ปรึกษาผู้เชี่ยวชาญฟรี" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-slate-600 shrink-0">
                <f.icon size={18} className="text-brand-emerald shrink-0" />
                <span className="whitespace-nowrap">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories — hidden on mobile, where the quick category grid right
          under the header search bar already shows these same categories;
          desktop keeps this section since it has no such shortcut. Moved
          above Promotions so browsing-by-type comes before deals. */}
      <section className="hidden md:block bg-white py-8 md:py-20">
        <ScrollReveal className="container-page">
          <SectionHeading title="ช้อปตามหมวดหมู่" subtitle="Product Categories" href="/shop" />
        </ScrollReveal>
        <StaggerGrid className="container-page grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-6">
          {categories.map((c) => (
            <Link key={c.slug} href={`/shop/${c.slug}`} className="group flex flex-col items-center gap-3">
              <div className="relative h-16 w-16 md:h-28 md:w-28 rounded-full overflow-hidden bg-white shadow-card group-hover:shadow-cardHover group-hover:-translate-y-1 transition-all duration-300">
                <Image src={c.image} alt={c.name} fill className="object-cover" />
              </div>
              <span className="text-xs md:text-base text-center font-medium text-slate-600 group-hover:text-brand-emerald">
                {c.nameTh}
              </span>
            </Link>
          ))}
        </StaggerGrid>
      </section>

      {/* Promotions — was the first section after Trust strip (filling the
          slot the mobile-only "today's deals" slider used to occupy);
          Categories now leads instead, so this follows it. */}
      <section className="bg-surface-soft py-8 md:py-20">
        {/* Thai title hidden on mobile so the cards sit close to the top;
            the English label stays, centered, as a small standalone eyebrow
            instead of the full left-aligned heading block. */}
        <p className="md:hidden text-center text-[11px] font-bold uppercase tracking-[0.2em] text-brand-emerald mb-6">
          New, Best Sellers and Promotions
        </p>
        <ScrollReveal className="container-page hidden md:block">
          <SectionHeading title="โปรโมชั่นและดีลเด็ด" subtitle="New, Best Sellers and Promotions" href="/promotions" />
        </ScrollReveal>
        <StaggerGrid className="container-page grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" stagger={0.1}>
          {promotions.map((promo) => (
            <Link
              key={promo.slug}
              href={`/promotions#${promo.slug}`}
              className="relative rounded-xl2 overflow-hidden aspect-[4/3] group shadow-card"
            >
              <Image
                src={promotionImage(promo, products, usedPromoSlugs)}
                alt={promo.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
              <div className="absolute bottom-0 left-0 p-3 md:p-4 text-white">
                <span className="text-[10px] font-bold uppercase bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">
                  {promo.badge}
                </span>
                <h3 className="font-bold text-sm md:text-base mt-1">{promo.title}</h3>
                <p className="text-[11px] md:text-xs text-white/80">{promo.subtitle}</p>
              </div>
            </Link>
          ))}
        </StaggerGrid>
      </section>

      {/* Concern hub teaser — moved up next to Categories: both are entry
          points into the catalogue (browse by type vs. browse by problem),
          so grouping them together strengthens the "ways to start shopping"
          cluster right after the hero, instead of splitting it far apart
          from Categories with unrelated content in between. */}
      <section className="bg-white py-8 md:py-20">
        <ScrollReveal className="container-page">
          <SectionHeading title="ช้อปตามปัญหาผิวที่กังวล" subtitle="Shop by Concern" href="/concern" />
        </ScrollReveal>
        <StaggerGrid className="container-page grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {concerns.map((c) => (
            <Link key={c.slug} href={`/concern/${c.slug}`} className="group rounded-xl2 bg-white overflow-hidden shadow-card">
              <div className="relative aspect-square">
                <Image src={concernImage(c.slug)} alt={c.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-brand-ink line-clamp-2">{c.nameTh}</p>
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

      {/* Trending on social — moved after the deals/catalog cluster: video
          engagement content works better once someone has already seen
          what's for sale, as a "see it in action" follow-up rather than a
          detour before they've even reached the product grid. Real
          product-video clips (Firework CDN), each linking through to the
          real product it shows. */}
      <TrendingOnSocial clips={socialClips} initialIndex={socialClipSlugs.indexOf("dentiste-repaire-rex3-70g")} />

      {/* Subscription teaser — moved later on purpose: committing to a
          recurring plan is a bigger ask than a one-off purchase, so it
          converts better after the catalogue, social proof, and brand story
          above have already built trust, rather than pitching it early. */}
      <section className="container-page py-8 md:py-20">
        <ScaleReveal className="relative overflow-hidden rounded-xl2 bg-brand-gradient p-8 md:p-12 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 animate-floatSlow" />
          <div className="pointer-events-none absolute right-24 bottom-0 h-24 w-24 rounded-full bg-white/10 animate-floatSlow" />
          <div className="relative grid md:grid-cols-[1.1fr,1fr] gap-8 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-semibold mb-4">
                <Repeat size={13} /> สมัครสมาชิกรายรอบ ไม่ต้องสั่งซ้ำ
              </span>
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight leading-tight">
                เลือกรอบส่งของคุณเอง <br className="hidden md:block" />
                ยิ่งนานยิ่งประหยัด
              </h2>
              <p className="mt-3 text-white/85 max-w-md">
                สมัคร Subscription สินค้าสุขภาพและความงามที่คุณใช้ประจำ เลือกได้ 3 / 6 / 12 เดือน
                ประหยัดสูงสุด {Math.max(...subscriptionPlans.map((p) => p.discountPct))}%
              </p>
              <Link
                href="/subscription"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white text-brand-emerald font-bold px-6 py-3 text-sm shadow-card hover:shadow-cardHover hover:-translate-y-0.5 transition-all"
              >
                <PercentCircle size={16} /> ดูแผนสมัครสมาชิก
              </Link>
            </div>
            {/* Mobile: 3 full-width rows stacked made this card very tall
                with a lot of unused horizontal room either side — a
                3-across compact grid uses that width instead, so the whole
                plan picker fits in roughly a third of the vertical space.
                Desktop keeps the wider stacked rows (room for the sublabel
                text next to the discount). */}
            <div className="grid grid-cols-3 gap-2 md:hidden">
              {subscriptionPlans.map((plan) => (
                <div
                  key={plan.months}
                  className={`relative flex flex-col items-center gap-0.5 rounded-xl2 px-2 py-3 text-center backdrop-blur transition-all ${
                    plan.popular ? "bg-white text-brand-ink shadow-cardHover scale-[1.03]" : "bg-white/15 text-white"
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2 rounded-full bg-brand-gradient text-white text-[9px] font-bold px-2 py-0.5">
                      ยอดนิยม
                    </span>
                  )}
                  <p className="font-bold text-xs mt-1.5">{plan.months} เดือน</p>
                  <span className={`text-base font-extrabold ${plan.popular ? "text-brand-emerald" : "text-white"}`}>
                    -{plan.discountPct}%
                  </span>
                  <p className={`text-[10px] leading-tight ${plan.popular ? "text-slate-500" : "text-white/70"}`}>
                    {plan.sublabel}
                  </p>
                </div>
              ))}
            </div>
            <div className="hidden md:flex flex-col gap-2.5">
              {subscriptionPlans.map((plan) => (
                <div
                  key={plan.months}
                  className={`flex items-center justify-between rounded-xl2 px-4 py-3 backdrop-blur transition-all ${
                    plan.popular ? "bg-white text-brand-ink shadow-cardHover scale-[1.03]" : "bg-white/15 text-white"
                  }`}
                >
                  <div>
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      {plan.label}
                      {plan.popular && (
                        <span className="rounded-full bg-brand-gradient text-white text-[10px] font-bold px-2 py-0.5">
                          ยอดนิยม
                        </span>
                      )}
                    </p>
                    <p className={`text-xs ${plan.popular ? "text-slate-500" : "text-white/70"}`}>{plan.sublabel}</p>
                  </div>
                  <span className={`text-lg font-extrabold ${plan.popular ? "text-brand-emerald" : "text-white"}`}>
                    -{plan.discountPct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ScaleReveal>
      </section>

      {/* Brands strip — scrolling logo wall at every breakpoint. Used to be
          a static desktop grid capped at the first 10 brands, but the
          catalogue now spans dozens of real vendors (see brands.ts), so a
          fixed grid either got enormous or hid most of them; the marquee
          scales to any count without bloating page height and actually
          shows the full range of brands we carry. */}
      <section className="bg-surface-soft py-8 md:py-20 overflow-hidden">
        <ScrollReveal className="container-page">
          <SectionHeading title="แบรนด์ที่คุณไว้วางใจ" subtitle="Brands" href="/brands" />
        </ScrollReveal>
        <ScrollReveal>
          <BrandMarquee brands={brands} />
        </ScrollReveal>
      </section>

      {/* Wellness / knowledge teaser — kept last: bottom-funnel content for
          people still researching rather than ready to buy or subscribe. */}
      <section className="bg-brand-gradient-soft py-8 md:py-20">
        <ScrollReveal className="container-page">
          <SectionHeading title="ความรู้เรื่องผิวและสุขภาพ" subtitle="Learn About Wellness" href="/knowledge" />
        </ScrollReveal>
        {/* Horizontal swipe on mobile (native scroll-snap, no slider JS)
            instead of 3 full-width cards stacked one under another —
            desktop keeps the 3-column grid since there's room for all of
            them at once. */}
        {/* container-page's padding is correctly respected once this
            becomes a grid at sm+, but is silently ignored at the leading
            edge while it's a flex+overflow-x-auto row on mobile (a real
            browser quirk, confirmed) — the sm:hidden spacers below give
            mobile its gutter explicitly instead of fighting that. */}
        <StaggerGrid className="container-page flex sm:grid overflow-x-auto snap-x snap-mandatory scrollbar-none sm:overflow-visible gap-4 md:gap-5 sm:grid-cols-3">
          <div className="shrink-0 w-0 sm:hidden snap-start" aria-hidden />
          {featuredArticles.map((a) => (
            <Link
              key={a.slug}
              href={`/knowledge/article/${a.slug}`}
              className="group shrink-0 w-[78%] sm:w-auto snap-start rounded-xl2 bg-white overflow-hidden shadow-card hover:shadow-cardHover transition-shadow"
            >
              <div className="relative aspect-[16/9]">
                <Image
                  src={a.image}
                  alt={a.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-bold uppercase text-brand-emerald bg-brand-gradient-soft px-2 py-0.5 rounded-full">
                  {articleCategoryLabel[a.category] || a.category}
                </span>
                <h3 className="font-bold text-sm text-brand-ink mt-2 line-clamp-2">{a.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.excerpt}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock size={11} /> {a.readMins} นาที
                  </span>
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-brand-emerald">
                    อ่านต่อ <ChevronRight size={13} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
          <div className="shrink-0 w-0 sm:hidden snap-start" aria-hidden />
        </StaggerGrid>
      </section>
    </div>
  );
}
