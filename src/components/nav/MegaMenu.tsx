"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { menuCategories } from "@/data/nav-menu";
import { CATEGORY_ICON } from "@/components/icons/CategoryIcons";

// The shop menu, on a screen with a pointer.
//
// The reference was Konvy's: four columns of links, a brand grid, everything
// at one size and nothing with room around it, so the eye has nowhere to land.
// This keeps its shape — categories on the left, their contents on the right —
// and takes the discipline from lululemon and Urban Outfitters instead: few
// links under a heading, one picture, and space.
//
// The panel is not hover-only. Hover opens it because that is what a pointer
// expects, but the trigger is a real button that opens on click and on Enter,
// the panel closes on Escape, and every row inside is reachable by Tab — a
// menu that only exists while a mouse is held still is a menu keyboard and
// screen-reader users do not have.

const CLOSE_DELAY = 120;

export default function MegaMenu({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState(menuCategories[0]?.slug);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const active =
    menuCategories.find((c) => c.slug === activeSlug) ?? menuCategories[0];

  // A pointer that leaves for a moment on its way to the panel should not close
  // it; one that leaves for good should.
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClickAway = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickAway);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickAway);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  if (menuCategories.length === 0) {
    return (
      <Link href={href} className="transition-colors hover:text-brand-800">
        {label}
      </Link>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="static"
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      {/* The label is a link and the chevron is the toggle, which is the only
          arrangement where all three ways in behave the way each one expects.
          One element doing both meant the pointer opened the panel on enter
          and the click that followed toggled it straight back shut. */}
      <span
        className="inline-flex items-center gap-0.5"
        onMouseEnter={() => setOpen(true)}
      >
        <Link
          href={href}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(false)}
          className="rounded-md py-1 transition-colors hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
        >
          {label}
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `ปิดเมนู${label}` : `เปิดเมนู${label}`}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen((v) => !v)}
          className="grid size-6 place-items-center rounded-md text-slate-400 transition-colors hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </span>

      {open && (
        <div
          id={panelId}
          // Frosted rather than solid: the panel hangs over the page, and
          // letting the page come through it — blurred and brightened —
          // keeps it reading as a layer above the shop instead of a second
          // page covering it. The inset hairline is the lit top edge that
          // makes glass look like glass; without it the panel is just a
          // translucent rectangle.
          //
          // Blurred far past the point where anything behind is legible, on
          // purpose. What sits under this panel is the hero — photographs
          // with dark areas and type of their own — and at a gentler blur
          // their edges read as contrast behind the menu's own text. At
          // 72px nothing survives but colour, so the page still shows
          // through as light and tint while every line on top stays
          // readable. brightness lifts whatever dark frame lands behind it
          // so the near-black labels keep their contrast.
          className="absolute inset-x-0 top-full z-50 max-h-[80vh] overflow-y-auto border-t border-white/60 bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_24px_60px_-28px_rgba(0,53,41,0.45)] backdrop-blur-[72px] backdrop-brightness-125 backdrop-saturate-150 animate-fadeUp"
        >
          <div className="container-page grid gap-0 py-6 md:grid-cols-[230px_1fr_340px] 2xl:grid-cols-[230px_1fr_400px]">
            {/* Categories. Pointing at one changes the two panels beside it —
                Etsy's idea, and the only way six categories and their contents
                fit without becoming a wall. */}
            <ul className="border-slate-100 pe-4 md:border-e">
              {menuCategories.map((c) => {
                const on = c.slug === active?.slug;
                return (
                  <li key={c.slug}>
                    <Link
                      href={c.href}
                      onMouseEnter={() => setActiveSlug(c.slug)}
                      onFocus={() => setActiveSlug(c.slug)}
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-[14px] transition-colors ${
                        on
                          ? "bg-surface-soft font-semibold text-brand-800"
                          : "text-slate-600 hover:bg-surface-soft"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        {/* The same drawn marks the home and /shop rows use.
                            These were packshots of whatever each category
                            sold best that week, which at 28px is a pale
                            smudge and a different smudge every rebuild. */}
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/80 ring-1 ring-slate-200/70">
                          {(() => {
                            const Icon = CATEGORY_ICON[c.slug];
                            return Icon ? (
                              <Icon
                                className="size-7 text-brand-1000"
                                blobClassName={on ? "text-brand-400/45" : "text-brand-200/70"}
                              />
                            ) : null;
                          })()}
                        </span>
                        {c.label}
                      </span>
                      <ChevronRight
                        size={14}
                        className={on ? "opacity-60" : "opacity-0"}
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* What is under the category being pointed at, and one thing to
                look at beside it — lululemon's idea, and the only thing that
                keeps a category with no concern data from being half empty. */}
            <div className="grid gap-x-8 gap-y-6 px-0 pt-2 sm:grid-cols-[1fr_1fr_auto] md:px-8 md:pt-0">
              {active?.groups.map((g) => (
                <div key={g.title}>
                  <p className="text-[12px] font-semibold text-slate-400">
                    {g.title}
                  </p>
                  <ul className="mt-2.5 flex flex-col">
                    {g.items.map((i) => (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          onClick={() => setOpen(false)}
                          className="block rounded-md py-1.5 text-[14px] text-slate-600 transition-colors hover:text-brand-800"
                        >
                          {i.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {active?.featured && (
                <Link
                  href={`/product/${active.featured.slug}`}
                  onClick={() => setOpen(false)}
                  className="group hidden w-[168px] flex-col sm:flex"
                >
                  <span className="relative aspect-square overflow-hidden rounded-xl2 bg-surface-soft">
                    <Image
                      src={active.featured.image}
                      alt=""
                      fill
                      sizes="168px"
                      className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                    />
                  </span>
                  <span className="mt-2 text-[11px] text-slate-400">
                    ขายดีใน{active.label}
                  </span>
                  <span className="line-clamp-2 text-[13px] leading-snug text-slate-700">
                    {active.featured.name}
                  </span>
                  <span className="mt-0.5 text-[13px] font-semibold text-brand-800">
                    ฿{active.featured.price.toLocaleString("th-TH")}
                  </span>
                </Link>
              )}
            </div>

            {/* Brands in this category, as the logos people actually scan for. */}
            <div className="border-slate-100 ps-0 pt-6 md:border-s md:ps-6 md:pt-0">
              <p className="text-[12px] font-semibold text-slate-400">
                แบรนด์ใน{active?.label}
              </p>
              {/* Two across, in a square tile, because nearly every one of
                  these logo files is square — 800x800, 1200x1200, 1280x1280.
                  In the 5:3 tile this began as, object-contain fitted them to
                  the tile's *height*, so a 134px-wide tile carried a 68px
                  mark with white either side of it. A square tile is the
                  shape the artwork already is, and it ends at 146px, or 176
                  on a large monitor where the rail can afford to be wider.

                  Three across rather than two. A square tile at two across
                  was 146px of mostly white around a logo; at three it is
                  about 95px, which is as big as these marks need to be read,
                  and the six brands fit in two rows instead of three. */}
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {active?.brands.map((b) => (
                  <li key={b.slug}>
                    <Link
                      href={`/brands/${b.slug}`}
                      onClick={() => setOpen(false)}
                      title={b.name}
                      className="grid aspect-square place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-100 transition-colors hover:ring-brand-teal"
                    >
                      {b.image ? (
                        <span className="relative h-full w-full">
                          <Image
                            src={b.image}
                            alt={b.name}
                            fill
                            sizes="120px"
                            className="object-contain p-1"
                          />
                        </span>
                      ) : (
                        <span className="px-1.5 text-center text-[11px] font-medium leading-tight text-slate-600">
                          {b.name}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/brands"
                onClick={() => setOpen(false)}
                className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-800"
              >
                ดูแบรนด์ทั้งหมด <ChevronRight size={13} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
