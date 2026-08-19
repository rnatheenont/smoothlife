import Image from "next/image";
import Link from "next/link";
import { Play, ShoppingBag } from "lucide-react";
import { Product } from "@/data/types";
import StarRating from "./StarRating";

// A social/UGC-style "reels" strip — vertical cards with a play affordance,
// styled after the shoppable video rail on the real smoothlife.com
// homepage. We don't have licensed video assets to embed here, so each
// card uses that same product's real catalogue photo as the poster and
// links straight to its real product page — real data, no placeholder
// stand-ins for the video files themselves.
export default function ShoppableReels({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1 -mx-4 px-4 md:mx-0 md:px-0">
      {products.map((p) => (
        <Link
          key={p.slug}
          href={`/product/${p.slug}`}
          className="group relative shrink-0 snap-start w-[38vw] sm:w-44 md:w-52 aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 shadow-card"
        >
          <Image
            src={p.image}
            alt={p.name}
            fill
            sizes="(max-width: 768px) 40vw, 208px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />

          <span className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/25 backdrop-blur text-white">
            <ShoppingBag size={14} />
          </span>

          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-11 w-11 md:h-12 md:w-12 place-items-center rounded-full bg-white/90 text-brand-ink shadow-lg transition-transform group-hover:scale-110">
              <Play size={18} className="fill-brand-ink ml-0.5" />
            </span>
          </span>

          <div className="absolute inset-x-0 bottom-0 p-3">
            {p.reviewCount > 0 && (
              <div className="mb-1 scale-90 origin-left">
                <StarRating rating={p.rating} size={11} />
              </div>
            )}
            <p className="text-xs md:text-sm font-bold text-white line-clamp-2 leading-snug">{p.name}</p>
            <span className="mt-1.5 inline-flex items-center rounded-full bg-white text-brand-ink text-[10px] font-bold px-2 py-1 opacity-0 -translate-y-1 transition-all group-hover:opacity-100 group-hover:translate-y-0">
              ดูสินค้า
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
