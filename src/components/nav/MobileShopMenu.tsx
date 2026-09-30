"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { menuCategories } from "@/data/nav-menu";
import { categoryImage } from "@/data/categories";

// The same menu on a phone, which has no hover and no room for three columns.
//
// A mega panel does not shrink into a drawer; it has to be rebuilt as one
// thing at a time. So each category is a row that opens in place — Amazon's
// pattern — and the row itself stays a link, because somebody who wants the
// whole category should not have to expand it first to find "ทั้งหมด".

export default function MobileShopMenu({ onNavigate }: { onNavigate: () => void }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  if (menuCategories.length === 0) return null;

  return (
    <div className="flex flex-col">
      <p className="px-2.5 pb-1.5 text-[11px] font-semibold text-slate-400">ช้อปตามหมวดหมู่</p>
      <ul className="flex flex-col">
        {menuCategories.map((c) => {
          const expanded = openSlug === c.slug;
          return (
            <li key={c.slug} className="border-b border-slate-100 last:border-b-0">
              <div className="flex items-center">
                <Link
                  href={c.href}
                  onClick={onNavigate}
                  className="flex min-h-12 flex-1 items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-slate-700"
                >
                  <span className="relative size-8 shrink-0 overflow-hidden rounded-full bg-surface-soft">
                    <Image src={categoryImage(c.slug)} alt="" fill sizes="32px" className="object-cover" />
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
