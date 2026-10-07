"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCollectionByHandle, getCollectionProducts } from "@/data/collections";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useRailFade } from "@/lib/use-rail-fade";
import ProductCard from "@/components/ProductCard";

// The campaign banner and the shelf under it.
//
// Both come from the widget the admin edits: the artwork, where it leads, and
// which Shopify collection fills the row. The collection is named by handle
// rather than listed product by product, because the merchandisers already
// curate it in Shopify and a second list here would be a second thing to keep
// in step.
//
// With no artwork set it still works: the band draws itself from the brand
// gradient and the headline, so an admin can run a sale before the designer
// has sent the banner.

const SHOWN = 10;

export default function FlashSaleShelf() {
  const { settings, loaded } = useWidgetSettings();
  const rail = useRailFade();
  const widget = settings.flash_sale_shelf;
  const cfg = widget.config as {
    image?: string;
    href?: string;
    collection?: string;
    titleTh?: string;
  };

  const collection = cfg.collection ? getCollectionByHandle(cfg.collection) : undefined;
  const shelf = collection
    ? getCollectionProducts(collection)
        .filter((p) => p.inStock && p.image)
        .slice(0, SHOWN)
    : [];

  if (!loaded || !widget.enabled) return null;
  // A banner with nothing behind it is an advert for an empty shelf.
  if (!cfg.image && !cfg.titleTh && shelf.length === 0) return null;

  const href = cfg.href || (cfg.collection ? `/collections/${cfg.collection}` : "/promotions");
  const title = cfg.titleTh || collection?.title || "ดีลลับช้อปของใช้";

  return (
    <section className="py-6 md:py-8">
      <div className="mx-auto max-w-[1512px] px-4 md:px-6">
        <Link
          href={href}
          className="relative block overflow-hidden rounded-2xl transition-shadow duration-300 hover:shadow-cardHover"
        >
          {cfg.image ? (
            // The artwork is a wide campaign strip; 1512x260 is the shape the
            // design uses, and anything close to it fills without cropping
            // anything that matters.
            <span className="relative block aspect-[1512/260] bg-surface-soft">
              <Image src={cfg.image} alt={title} fill sizes="(max-width:1512px) 100vw, 1512px" className="object-cover" />
            </span>
          ) : (
            <span className="flex min-h-[112px] items-center bg-brand-gradient px-5 py-6 md:min-h-[180px] md:px-10">
              <span className="text-xl font-bold leading-snug text-white md:text-[32px] lg:text-[38px]">{title}</span>
            </span>
          )}
          <span className="absolute right-5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-800 shadow-card md:right-10 md:h-16 md:w-16">
            <ChevronRight size={24} className="md:hidden" />
            <ChevronRight size={32} className="hidden md:block" />
          </span>
        </Link>

        {shelf.length > 0 && (
          <ul
            ref={rail.ref}
            style={rail.style}
            className="-m-2 mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto p-2 scrollbar-none md:gap-4"
          >
            {shelf.map((p) => (
              <li
                key={p.slug}
                className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start md:w-[calc((100%-3rem)/3.5)] lg:w-[calc((100%-6rem)/6.5)]"
              >
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
