import Link from "next/link";
import Image from "next/image";
import { Sparkles, ShieldCheck, Truck, Award, MessageCircle, Clock, ChevronRight, Repeat, PercentCircle } from "lucide-react";
import { products } from "@/data/products";
import { Product } from "@/data/types";
import { categories, concerns, concernImage } from "@/data/categories";
import { brands, houseBrands, slugifyVendor } from "@/data/brands";
import { promotions, promotionImage } from "@/data/promotions";
import { articles } from "@/data/articles";
import { subscriptionPlans } from "@/data/subscriptions";
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
import BrandShowcase from "@/components/BrandShowcase";
import TrendingOnSocial, { SocialClip } from "@/components/TrendingOnSocial";

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
  const brandProducts = (brandSlug: string) => {
    const brand = brands.find((b) => b.slug === brandSlug);
    if (!brand) return [];
    const aliases = [brand.name, ...(brand.vendorAliases || [])].map(slugifyVendor);
    return products.filter((p) => p.inStock && aliases.includes(slugifyVendor(p.brand))).slice(0, 8);
  };
  const houseBrandProducts = Object.fromEntries(houseBrands.map((b) => [b.slug, brandProducts(b.slug)]));
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
      {/* Hero */}
      <section className="bg-white">
        <div className="container-page py-10 md:py-24 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <StaggerReveal className="order-2 md:order-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-emerald shadow-card mb-5 border border-slate-100">
              <Sparkles size={13} /> แนะนำน้อง Smoothie ผู้ช่วยคนใหม่
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.05] tracking-tight text-brand-ink">
              สุขภาพดี ผิวสวย <br />
              <span className="brand-text-gradient">ครบทุก Lifestyle</span> ที่เดียว
            </h1>
            <p className="mt-5 text-slate-500 max-w-md leading-relaxed">
              ค้นหาสินค้าง่าย ซื้อเร็ว เข้าสู่ระบบด้วย OTP หรือ LINE พร้อมรับคะแนนสะสมทุกการช้อป
              ของแท้ 100% มีอย. จัดส่งฟรีทั่วไทย
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="rounded-full bg-brand-gradient text-white font-semibold px-7 py-3.5 text-sm shadow-cardHover hover:-translate-y-0.5 hover:shadow-xl transition-all"
              >
                เริ่มช้อปเลย
              </Link>
              <Link
                href="/advisor"
                className="rounded-full bg-white border border-slate-200 text-brand-ink font-semibold px-7 py-3.5 text-sm hover:border-brand-teal hover:-translate-y-0.5 transition-all"
              >
                ให้น้อง Smoothie แนะนำสกินแคร์
              </Link>
            </div>
          </StaggerReveal>
          <div className="order-1 md:order-2">
            <HeroCarousel banners={liveHeroBanners ?? heroBanners} />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-slate-100 bg-white">
        <div className="container-page py-4 md:py-5">
          <StaggerGrid
            className="flex md:grid md:grid-cols-4 gap-5 md:gap-4 overflow-x-auto scrollbar-none text-xs md:text-sm"
            stagger={0.1}
          >
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
          </StaggerGrid>
        </div>
      </section>

      {/* Categories */}
      <section className="bg-surface-soft py-14 md:py-20">
        <ScrollReveal className="container-page">
          <SectionHeading title="ช้อปตามหมวดหมู่" subtitle="Product Categories" href="/shop" />
        </ScrollReveal>
        <StaggerGrid className="container-page grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          {categories.map((c) => (
            <Link key={c.slug} href={`/shop/${c.slug}`} className="group flex flex-col items-center gap-2">
              <div className="relative h-16 w-16 md:h-20 md:w-20 rounded-full overflow-hidden bg-white shadow-card group-hover:shadow-cardHover group-hover:-translate-y-1 transition-all duration-300">
                <Image src={c.image} alt={c.name} fill className="object-cover" />
              </div>
              <span className="text-xs md:text-sm text-center font-medium text-slate-600 group-hover:text-brand-emerald">
                {c.nameTh}
              </span>
            </Link>
          ))}
        </StaggerGrid>
      </section>

      {/* Promotions */}
      <section className="bg-white py-14 md:py-20">
        <ScrollReveal className="container-page">
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

      {/* Trending on social — real product-video clips (Firework CDN),
          each linking through to the real product it shows. */}
      <TrendingOnSocial clips={socialClips} initialIndex={socialClipSlugs.indexOf("dentiste-repaire-rex3-70g")} />

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

      {/* Subscription teaser */}
      <section className="container-page py-14 md:py-20">
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
            <div className="flex flex-col gap-2.5">
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

      {/* Life So Smooth — house brands (Smooth E > Smooth Life > Dentiste,
          always in that priority order) told as one story instead of a
          stack of near-identical per-brand carousels. */}
      <BrandShowcase brands={houseBrands} productsBySlug={houseBrandProducts} />

      {/* Concern hub teaser */}
      <section className="bg-white py-14 md:py-20">
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

      {/* No separate AI-advisor CTA section — the hero already offers this
          exact path ("ให้น้อง Smoothie แนะนำสกินแคร์"), so a second full
          section repeating it further down was pure redundancy. */}

      {/* Brands strip — scrolling logo wall at every breakpoint. Used to be
          a static desktop grid capped at the first 10 brands, but the
          catalogue now spans dozens of real vendors (see brands.ts), so a
          fixed grid either got enormous or hid most of them; the marquee
          scales to any count without bloating page height and actually
          shows the full range of brands we carry. */}
      <section className="bg-surface-soft py-14 md:py-20 overflow-hidden">
        <ScrollReveal className="container-page">
          <SectionHeading title="แบรนด์ที่คุณไว้วางใจ" subtitle="Brands" href="/brands" />
        </ScrollReveal>
        <ScrollReveal>
          <BrandMarquee brands={brands} />
        </ScrollReveal>
      </section>

      {/* Wellness / knowledge teaser */}
      <section className="bg-brand-gradient-soft py-14 md:py-20">
        <ScrollReveal className="container-page">
          <SectionHeading title="ความรู้เรื่องผิวและสุขภาพ" subtitle="Learn About Wellness" href="/knowledge" />
        </ScrollReveal>
        <StaggerGrid className="container-page grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5" stagger={0.12}>
          {featuredArticles.map((a) => (
            <Link
              key={a.slug}
              href={`/knowledge/article/${a.slug}`}
              className="group rounded-xl2 bg-white overflow-hidden shadow-card hover:shadow-cardHover transition-shadow"
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
        </StaggerGrid>
      </section>
    </div>
  );
}
