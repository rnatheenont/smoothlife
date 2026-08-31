import Image from "next/image";
import { promotions, promotionImage } from "@/data/promotions";
import { products } from "@/data/products";
import ProductCard from "@/components/ProductCard";

export const metadata = { title: "โปรโมชั่นและดีลเด็ด | Smoothlife.com" };

export default function PromotionsPage() {
  const usedPromoSlugs = new Set<string>();
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">New, Best Sellers and Promotions</h1>
      <p className="text-sm text-slate-500 mb-8">รวมโปรโมชั่นและดีลพิเศษประจำเดือนจาก Smooth Life</p>

      {promotions.map((promo, i) => {
        const items = products.filter((p) => p.badges?.some((b) => b === promo.badge)).slice(0, 4);
        const fallback = products.slice(i * 4, i * 4 + 4);
        const display = items.length > 0 ? items : fallback;
        return (
          <section key={promo.slug} id={promo.slug} className="mb-14 scroll-mt-24">
            <div className="relative rounded-xl2 overflow-hidden h-40 md:h-56 mb-5">
              <Image src={promotionImage(promo, products, usedPromoSlugs)} alt={promo.title} fill className="object-cover" />
              <div className="absolute inset-0 bg-linear-to-r from-black/60 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-center p-6 md:p-10 text-white">
                <span className="text-[11px] font-bold uppercase bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full w-fit">
                  {promo.badge}
                </span>
                <h2 className="text-xl md:text-3xl font-bold mt-2">{promo.title}</h2>
                <p className="text-sm text-white/80">{promo.subtitle}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
              {display.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
