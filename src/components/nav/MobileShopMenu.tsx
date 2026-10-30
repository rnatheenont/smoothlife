"use client";

import { useState } from "react";
import Image from "next/image";
import { iconThemeSrc } from "@/lib/category-icon-theme";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { MenuCategory } from "@/data/nav-menu";

// The same menu on a phone, which has no hover and no room for three columns.
//
// A mega panel does not shrink into a drawer; it has to be rebuilt as one
// thing at a time. So each category is a row that opens in place — Amazon's
// pattern — and the row itself stays a link, because somebody who wants the
// whole category should not have to expand it first to find "ทั้งหมด".

export default function MobileShopMenu({ menu, onNavigate }: { menu: MenuCategory[]; onNavigate: () => void }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  if (menu.length === 0) return null;

  return (
    <div className="flex flex-col">
      <p className="px-2.5 pb-1.5 text-[11px] font-semibold text-slate-400">ช้อปตามหมวดหมู่</p>
      <ul className="flex flex-col">
        {menu.map((c) => {
          const expanded = openSlug === c.slug;
          return (
            <li key={c.slug} className="border-b border-slate-100 last:border-b-0">
              <div className="flex items-center">
                <Link
                  href={c.href}
                  onClick={onNavigate}
                  className="flex min-h-12 flex-1 items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-slate-700"
                >
                  {/* The same tile the header's menu uses — the rendered 3D
                      mark on white, not the category's photograph. The photo
                      is a crop of a product shot, which at 32px is a smear of
                      colour; two different pictures for one category in two
                      menus was also two things to keep in step. */}
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white ring-1 ring-slate-200/70">
                    {(() => {
                      const src = iconThemeSrc("3d", c.slug);
                      return src ? (
                        <Image src={src} alt="" width={64} height={64} className="size-7 object-contain" />
                      ) : (
                        <span className="relative size-7 overflow-hidden rounded-full">
                          <Image src={c.image} alt="" fill sizes="28px" className="object-cover" />
                        </span>
                      );
                    })()}
                  </span>
                  {c.label}
                </Link>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "ปิด" : "เปิด"}รายการย่อยของ${c.label}`}
                  onClick={() => setOpenSlug(expanded ? null : c.slug)}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                >
                  <ChevronDown size={16} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
                </button>
              </div>

              {expanded && (
                <div className="flex flex-col gap-3 pb-3 ps-[3.25rem] pe-2.5">
                  {c.groups.map((g) => (
                    <div key={g.title}>
                      <p className="text-[11px] font-semibold text-slate-400">{g.title}</p>
                      <ul className="mt-1 flex flex-col">
                        {g.items.map((i) => (
                          <li key={i.href}>
                            <Link
                              href={i.href}
                              onClick={onNavigate}
                              className="flex min-h-10 items-center text-[13px] text-slate-600"
                            >
                              {i.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {c.brands.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">แบรนด์</p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.brands.slice(0, 6).map((b) => (
                          <li key={b.slug}>
                            <Link
                              href={`/brands/${b.slug}`}
                              onClick={onNavigate}
                              className="inline-flex min-h-9 items-center rounded-full bg-surface-soft px-3 text-[12px] text-slate-600"
                            >
                              {b.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
