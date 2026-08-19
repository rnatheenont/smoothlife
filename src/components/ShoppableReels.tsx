"use client";

import "swiper/css";
import "swiper/css/effect-coverflow";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Autoplay } from "swiper/modules";
import Image from "next/image";
import Link from "next/link";
import { Play, ShoppingBag } from "lucide-react";
import { Product } from "@/data/types";
import StarRating from "./StarRating";
import clsx from "clsx";

function CardFace({ p, active }: { p: Product; active: boolean }) {
  return (
    <>
      <Image
        src={p.image}
        alt={p.name}
        fill
        draggable={false}
        sizes="(max-width: 768px) 40vw, 208px"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />

      <span className="absolute right-2.5 top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/25 backdrop-blur text-white">
        <ShoppingBag size={14} />
      </span>

      <span className="absolute inset-0 grid place-items-center">
        <span
          className={clsx(
            "grid place-items-center rounded-full bg-white/90 text-brand-ink shadow-lg transition-transform",
            active ? "h-12 w-12 md:h-14 md:w-14 scale-100" : "h-9 w-9 scale-90 opacity-80"
          )}
        >
          <Play size={active ? 20 : 15} className="fill-brand-ink ml-0.5" />
        </span>
      </span>

      <div className="absolute inset-x-0 bottom-0 p-3">
        {p.reviewCount > 0 && (
          <div className="mb-1 scale-90 origin-left">
            <StarRating rating={p.rating} size={11} />
          </div>
        )}
        <p className="text-xs md:text-sm font-bold text-white line-clamp-2 leading-snug">{p.name}</p>
        {active && (
          <span className="mt-1.5 inline-flex items-center rounded-full bg-white text-brand-ink text-[10px] font-bold px-2 py-1">
            ดูสินค้า
          </span>
        )}
      </div>
    </>
  );
}

// A social/UGC-style "reels" strip styled after GSAP's infinite card-slider
// pattern (demos.gsap.com/demo/infinite-card-slider) — the centered card
// sits big and sharp like it's "playing", the rest recede on either side.
// We don't have licensed video files to actually play, so each card shows
// that product's real catalogue photo as its poster and links to its real
// product page.
//
// Built on Swiper's own coverflow + autoplay + loop (swiperjs.com) instead
// of hand-rolled position/opacity math — battle-tested drag, swipe, and
// looping behavior for free. Auto-advances forever, pauses while the
// shopper's cursor/finger is on it, and resumes after they let go.
export default function ShoppableReels({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <Swiper
      modules={[EffectCoverflow, Autoplay]}
      effect="coverflow"
      grabCursor
      centeredSlides
      loop={products.length > 4}
      slidesPerView="auto"
      coverflowEffect={{ rotate: 0, stretch: 0, depth: 150, modifier: 1.8, slideShadows: false }}
      autoplay={{ delay: 2800, disableOnInteraction: false, pauseOnMouseEnter: true }}
      className="!py-2 !overflow-visible"
    >
      {products.map((p) => (
        <SwiperSlide key={p.slug} style={{ width: "38vw", maxWidth: 208 }} className="!h-auto">
          {({ isActive }) => (
            <Link
              href={`/product/${p.slug}`}
              draggable={false}
              className={clsx(
                "group relative block aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 transition-shadow",
                isActive ? "shadow-cardHover ring-2 ring-white/80" : "shadow-card"
              )}
            >
              <CardFace p={p} active={isActive} />
            </Link>
          )}
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
