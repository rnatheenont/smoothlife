"use client";

import { useEffect, useRef, useState } from "react";
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

export default function CategoryCircles({
  current,
  className,
  /**
   * "flow" is the row as drawn, sitting where it was put.
   *
   * "overlay" is the same row, shrunk, fixed under the app bar, and shown
   * only once the one above has scrolled away. It is fixed rather than
   * sticky because sticky can only travel inside its own parent, and on this
   * page the row's parent is either a wrapper exactly its own height or the
   * hero section — neither of which travels anywhere. A bar that is supposed
   * to follow you down 664 products cannot be parented to something 123
   * pixels tall.
   */
  mode = "flow",
}: {
  current: ShopSearchParams;
  className?: string;
  mode?: "flow" | "overlay";
}) {
  // Whether the row above has gone. The negative top margin means "crossed
  // under the app bar", not "left the window" — measured against a sentinel
  // rather than window.scrollY, so it stays right if anything above it ever
  // changes height.
  const [past, setPast] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mode !== "overlay") return;
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting), {
      rootMargin: "-120px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [mode]);

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

  const compact = mode === "overlay";

  return (
    <>
      {mode === "overlay" && <div ref={sentinel} aria-hidden className="h-px" />}
      <nav
        aria-label="หมวดหมู่สินค้า"
        // Out of the tab order and off the screen reader entirely while it
        // is not showing: it is a second copy of a row that is already on
        // the page, and two identical category menus in the tab order is a
        // worse problem than no shortcut back to them.
        {...(compact && !past ? { inert: "" as unknown as boolean, "aria-hidden": true } : {})}
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
        className={clsx(
          "scrollbar-none flex overflow-x-auto",
          compact
            ? // Fixed, so it follows the whole scroll. transition-[top]
              // matches the app bar's own 300ms slide, so the two move as
              // one piece rather than the bar snapping up a beat early.
              clsx(
                "fixed inset-x-0 top-(--app-header-h) z-30 gap-3 border-b border-slate-200/70 bg-white/95 px-4 py-2 backdrop-blur-sm transition-[top,opacity,transform] duration-300 md:gap-4 md:px-6",
                past ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
              )
            : "-mx-4 mb-6 gap-4 px-4 py-3 md:-mx-6 md:gap-5 md:px-6 lg:mx-0 lg:px-0 lg:py-0",
          className,
        )}
      >
      {items.map((item) => {
        const active = (current.category ?? null) === item.slug;
        return (
          <Link
            key={item.label}
            href={hrefFor(item.slug)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "group flex shrink-0 flex-col items-center text-center",
              compact ? "w-14 gap-1 md:w-16" : "w-16 gap-1.5 md:w-20",
            )}
          >
            <span
              className={clsx(
                "grid place-items-center rounded-full transition-[transform,border-color,background-color,box-shadow] duration-300 group-active:scale-95",
                compact ? "h-9 w-9 md:h-10 md:w-10" : "h-16 w-16 md:h-[72px] md:w-[72px]",
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
                className={compact ? "h-5 w-5 md:h-6 md:w-6" : "h-10 w-10 md:h-11 md:w-11"}
                blobClassName={active ? "text-brand-400/45" : "text-brand-200/70"}
              />
            </span>
            <span
              className={clsx(
                "leading-tight",
                compact ? "text-[10px]" : "text-[11px] md:text-xs",
                active ? "font-bold text-brand-800" : "text-slate-600"
              )}
            >
              {item.label}
            </span>
          </Link>
          );
        })}
      </nav>
    </>
  );
}
