"use client";

import Link from "next/link";
import clsx from "clsx";
import {
  AllCategoriesIcon,
  BodyCareIcon,
  HairCareIcon,
  OralCareIcon,
  PersonalCareIcon,
  SkincareIcon,
  WellnessIcon,
} from "@/components/icons/CategoryIcons";
import { categories } from "@/data/categories";
import type { ShopSearchParams } from "@/lib/filter-products";

// The category row a shopper scans first: one circle per real category, the
// active one ringed. Links rather than buttons, so a category is a URL people
// can share and the back button can return through.
//
// The circles used to hold a photograph of whatever that category happened to
// sell best that week. That made the row change shape on every rebuild and,
// at 64px, turned it into a line of pale smudges with no two alike. These are
// the same drawn marks the home page uses, for the same reason: a mark is the
// same mark every time and is still legible at 44px.
const ICONS: Record<string, typeof SkincareIcon> = {
  skincare: SkincareIcon,
  "oral-care": OralCareIcon,
  "hair-care": HairCareIcon,
  "personal-care": PersonalCareIcon,
  wellness: WellnessIcon,
  "body-care": BodyCareIcon,
};

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

  const items: { slug: string | null; label: string; Icon: typeof SkincareIcon }[] = [
    { slug: null, label: "ทั้งหมด", Icon: AllCategoriesIcon },
    ...categories.map((c) => ({
      slug: c.slug as string,
      label: c.nameTh,
      Icon: ICONS[c.slug] ?? AllCategoriesIcon,
    })),
  ];

  return (
    <nav
      aria-label="หมวดหมู่สินค้า"
      className="scrollbar-none -mx-4 mb-6 flex gap-4 overflow-x-auto px-4 md:mx-0 md:gap-5 md:px-0"
    >
      {items.map((item) => {
        const active = (current.category ?? null) === item.slug;
        return (
          <Link
            key={item.label}
            href={hrefFor(item.slug)}
            aria-current={active ? "page" : undefined}
            className="group flex w-16 shrink-0 flex-col items-center gap-1.5 text-center md:w-20"
          >
            <span
              className={clsx(
                "grid h-16 w-16 place-items-center rounded-full transition-all duration-300 group-active:scale-95 md:h-[72px] md:w-[72px]",
                active
                  ? "border border-brand-600 bg-brand-gradient-soft text-brand-900"
                  : "border border-slate-200/80 bg-white text-brand-1000 group-hover:border-brand-200 group-hover:shadow-card"
              )}
            >
              <item.Icon
                className="h-10 w-10 md:h-11 md:w-11"
                blobClassName={active ? "text-brand-300/60" : "text-brand-200/70"}
              />
            </span>
            <span
              className={clsx(
                "text-[11px] leading-tight md:text-xs",
                active ? "font-bold text-brand-800" : "text-slate-600"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
