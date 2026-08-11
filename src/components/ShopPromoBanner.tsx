import Image from "next/image";
import Link from "next/link";
import { promotions, promotionImage } from "@/data/promotions";
import { products } from "@/data/products";

export default function ShopPromoBanner() {
  return (
    <div className="mb-6 md:mb-8 -mx-4 md:mx-0 px-4 md:px-0">
      <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1">
        {promotions.map((promo) => (
          <Link
            key={promo.slug}
            href={`/promotions#${promo.slug}`}
            className="relative shrink-0 snap-start w-[70vw] sm:w-72 md:w-80 aspect-[16/9] rounded-xl2 overflow-hidden shadow-card group"
          >
            <Image
              src={promotionImage(promo, products)}
              alt={promo.title}
              fill
              sizes="(max-width: 768px) 70vw, 320px"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 p-3 md:p-4 text-white">
              <span className="text-[10px] font-bold uppercase bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">
                {promo.badge}
              </span>
              <h3 className="font-bold text-sm md:text-base mt-1">{promo.title}</h3>
              <p className="text-[11px] md:text-xs text-white/80">{promo.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
