"use client";

import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { LayoutGrid } from "lucide-react";
import { categories, categoryImage } from "@/data/categories";
import type { ShopSearchParams } from "@/lib/filter-products";

// The category row a shopper scans first: one circle per real category, the
// active one ringed. Links rather than buttons, so a category is a URL people
// can share and the back button can return through.
export default function CategoryCircles({ current }: { current: ShopSearchParams }) {
  function hrefFor(slug: string | null) {
    const params = new URLSearchParams();
    Object.entries(current).forEach(([k, v]) => {
      if (v && k !== "page" && k !== "category") params.set(k, v);
    });
    if (slug) params.set("category", slug);
    const qs = params.toString();
    return qs ? `/shop?${qs}` : "/shop";
  }

  const items: { slug: string | null; label: string; image: string | null }[] = [
    { slug: null, label: "ทั้งหมด", image: "/categories/all.png" },
    ...categories.map((c) => ({ slug: c.slug as string, label: c.nameTh, image: categoryImage(c.slug) })),
  ];

  return (
    <nav aria-label="หมวดหมู่สินค้า" className="scrollbar-none -mx-4 mb-6 flex gap-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      {items.map((item) => {
        const active = (current.category ?? null) === item.slug;
        return (
          <Link
            key={item.label}
            href={hrefFor(item.slug)}
            aria-current={active ? "page" : undefined}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center md:w-20"
          >
            <span
              className={clsx(
                "relative grid h-16 w-16 place-items-center overflow-hidden rounded-full transition-colors md:h-[72px] md:w-[72px]",
                active ? "bg-brand-gradient-soft ring-2 ring-brand-600" : "bg-surface-mist ring-1 ring-surface-line"
              )}
            >
              {item.image ? (
                <Image src={item.image} alt="" fill sizes="72px" className="object-cover" />
              ) : (
                <LayoutGrid size={22} className="text-brand-800" aria-hidden="true" />
              )}
            </span>
            <span className={clsx("text-[11px] leading-tight md:text-xs", active ? "font-bold text-brand-800" : "text-slate-600")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
