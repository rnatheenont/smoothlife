"use client";

import Link from "next/link";
import clsx from "clsx";
import { AllCategoriesIcon, CATEGORY_ICON, SkincareIcon } from "@/components/icons/CategoryIcons";
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
      Icon: CATEGORY_ICON[c.slug] ?? AllCategoriesIcon,
    })),
  ];

  return (
    <nav
      aria-label="หมวดหมู่สินค้า"
      // Sticks directly under the app bar so the category you are in, and the
      // one you want next, stay reachable however far down the grid you are —
      // 53 products is a lot of scrolling back. transition-[top] matches the
      // bar's own 300ms slide, so the two move as one piece rather than the
      // row snapping up a beat early.
      //
      // The background is not decoration: without it the product grid scrolls
      // through the circles. -mx-4/px-4 already let it bleed past the page
      // gutter on a phone, which is what keeps the bleed looking deliberate
      // once it is opaque.
      //
      // lg:static puts it back the way it was on desktop. The filter sidebar
      // is already sticky from lg, at its own offset, and a second pinned bar
      // across the top would have been sitting on the sidebar's first rows —
      // two things competing for the same corner. Below lg there is no
      // sidebar, which is exactly where pinning the categories pays.
      className="scrollbar-none sticky top-(--app-header-h) z-30 -mx-4 mb-6 flex gap-4 overflow-x-auto bg-white/95 px-4 py-3 backdrop-blur-sm transition-[top] duration-300 md:-mx-6 md:gap-5 md:px-6 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none"
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
                  ? "border border-brand-600 bg-brand-gradient-soft text-brand-1000"
                  : "border border-slate-200/80 bg-white text-brand-1000 group-hover:border-brand-200 group-hover:shadow-card"
              )}
            >
              {/* brand-200 and brand-400, because those are the two mints
                  the palette actually defines. A `text-brand-300` here fell
                  through to the inherited near-black and printed the blob as
                  a dark dot inside the mark — a colour class that does not
                  exist is not a no-op. */}
              <item.Icon
                className="h-10 w-10 md:h-11 md:w-11"
                blobClassName={active ? "text-brand-400/45" : "text-brand-200/70"}
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
