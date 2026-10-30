import { PAGES_WAVE1_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import Image from "next/image";
import { promotions } from "@/data/promotions";
import { products } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import ShopHero from "@/components/shop/ShopHero";
import { pageMetadata } from "@/lib/site-pages";
import { withCustomImages } from "@/lib/product-images";
import { toCardData } from "@/data/card";

export function generateMetadata() {
  return pageMetadata("promotions");
}

async function PromotionsPageWritten() {
  // Resolved up front rather than inside the loop: one query for the whole
  // page instead of one per promotion.
  const sections = await Promise.all(
    promotions.map(async (promo, i) => {
      const items = products.filter((p) => p.badges?.some((b) => b === promo.badge)).slice(0, 4);
      const fallback = products.slice(i * 4, i * 4 + 4);
      return { promo, display: await withCustomImages(items.length > 0 ? items : fallback) };
    }),
  );
  return (
    <>
      {/* The same banner /shop wears. */}
      <ShopHero
        eyebrow="PROMOTIONS"
        title="New, Best Sellers and Promotions"
        subtitle="รวมโปรโมชั่นและดีลพิเศษประจำเดือนจาก Smooth Life"
        count={promotions.length}
        countLabel="โปรโมชัน"
      />

      <div className="container-page py-8 md:py-10">

      {sections.map(({ promo, display }) => {
        return (
          <section key={promo.slug} id={promo.slug} className="mb-14 scroll-mt-24">
            <div className="relative rounded-xl2 overflow-hidden h-40 md:h-56 mb-5">
              <Image src={promo.image} alt={promo.title} fill className="object-cover object-[50%_35%]" />
              {/* Tinted to the banners' own teal — see the note in data/promotions.ts. */}
              <div className="absolute inset-0 bg-linear-to-r from-[#0d3436]/80 via-[#0d3436]/45 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-center p-6 md:p-10 text-white">
                <span className="text-[11px] font-bold bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full w-fit">
                  {promo.badge}
                </span>
                <h2 className="text-xl md:text-3xl font-bold mt-2">{promo.title}</h2>
                <p className="text-sm text-white/80">{promo.subtitle}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
              {display.map((p) => (
                <ProductCard key={p.slug} product={toCardData(p)} />
              ))}
            </div>
          </section>
        );
      })}
      </div>
    </>
  );
}

/** From the document when wave 1 is on — see the about pages. */
export default function PromotionsPage() {
  if (PAGES_WAVE1_ENABLED) return <SystemPageBody pageKey="promotions" />;
  return <PromotionsPageWritten />;
}
