"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, ExternalLink, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useAdminAction } from "@/components/admin/header-action";
import { categories, concerns } from "@/data/categories";
import { products } from "@/data/products";
import {
  DESCRIPTION_MAX,
  SEO_ANGLES,
  SEO_PAGE_TYPES,
  TITLE_MAX,
  type SeoOverride,
  type SeoPageType,
  type SeoSuggestion,
} from "@/lib/seo-overrides";

// The screen for writing what a page looks like in a search result.
//
// It always shows the generated default beside the box — the question is not
// "what should this page's title be" but "is the generated one good enough
// here", and most of the time it is. Leaving the box empty keeps the default,
// so an edit is a deliberate act and clearing one is an undo.

type Item = {
  key: string;
  label: string;
  sub?: string;
  image?: string | null;
  href: string;
  autoTitle: string;
  autoDescription?: string;
  context: string;
};

function itemsFor(type: SeoPageType): Item[] {
  if (type === "category") {
    return categories.map((c) => ({
      key: c.slug,
      label: c.nameTh,
      sub: c.name,
      image: c.image,
      href: `/shop/${c.slug}`,
      autoTitle: `${c.nameTh} | Smoothlife.com`,
      autoDescription: `ช้อปสินค้าหมวด ${c.nameTh} คุณภาพดี ราคาคุ้มค่า ที่ Smoothlife.com`,
      context: `หน้าหมวดหมู่สินค้า: ${c.nameTh} (${c.name}) บนเว็บ Smoothlife.com`,
    }));
  }
  if (type === "concern") {
    return concerns.map((c) => ({
      key: c.slug,
      label: c.nameTh,
      sub: c.name,
      image: c.image,
      href: `/concern/${c.slug}`,
      autoTitle: `${c.nameTh} | Smoothlife.com`,
      autoDescription: c.description,
      context: `หน้ารวมสินค้าสำหรับปัญหา: ${c.nameTh}\nคำอธิบายหมวด: ${c.description}`,
    }));
  }
  if (type === "product") {
    return products.slice(0, 1200).map((p) => ({
      key: p.slug,
      label: p.name,
      sub: p.brand,
      image: p.image,
      href: `/product/${p.slug}`,
      autoTitle: `${p.name} | Smoothlife.com`,
      autoDescription: p.shortDesc || undefined,
      context:
        `สินค้า: ${p.name}\nแบรนด์: ${p.brand}\nหมวดหมู่: ${p.category}\nราคา: ${p.price} บาท\n` +
        `คำอธิบายที่มีอยู่: ${(p.description || p.shortDesc || "(ไม่มี)").slice(0, 1200)}`,
    }));
  }
  return [];
}

export default function AdminSeoPage() {
  const [tab, setTab] = useState<SeoPageType>("product");
  const [overrides, setOverrides] = useState<Record<string, SeoOverride>>({});
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [angles, setAngles] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SeoSuggestion[]>([]);
  const [thinking, setThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  useAdminAction({
    label: "เปิดหน้าจริง",
    disabled: !selected,
    onClick: () => {
      if (selected) window.open(selected.href, "_blank", "noopener");
    },
  });

  async function load() {
    const res = await fetch("/api/admin/seo");
    const data = await res.json().catch(() => null);
    const map: Record<string, SeoOverride> = {};
    for (const row of data?.overrides ?? []) map[`${row.page_type}:${row.page_key}`] = row;
    setOverrides(map);
  }
  useEffect(() => {
    load();
  }, []);

  const items = useMemo(() => itemsFor(tab), [tab]);
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? items.filter((i) => `${i.label} ${i.sub ?? ""}`.toLowerCase().includes(q)) : items).slice(0, 60),
    [items, q]
  );

  function open(item: Item) {
    const row = overrides[`${tab}:${item.key}`];
    setSelected(item);
    setTitle(row?.meta_title ?? "");
    setDescription(row?.meta_description ?? "");
    setKeywords((row?.keywords ?? []).join(", "));
    setAngles([]);
    setSuggestions(row?.ai_suggestions ?? []);
    setNote("");
  }

  async function suggest() {
    if (!selected) return;
    setThinking(true);
    setNote("");
    try {
      const res = await fetch("/api/admin/seo/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_type: tab,
          page_key: selected.key,
          context: selected.context,
          keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
          angles,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setNote(data?.error || "ขอคำแนะนำไม่สำเร็จ");
        return;
      }
      setSuggestions(data.suggestions);
    } finally {
      setThinking(false);
    }
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setNote("");
    try {
      const res = await fetch("/api/admin/seo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_type: tab,
          page_key: selected.key,
          meta_title: title,
          meta_description: description,
          keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setNote(data?.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setNote(data.warning || "บันทึกแล้ว");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const edited = (item: Item) => {
    const row = overrides[`${tab}:${item.key}`];
    return Boolean(row?.meta_title || row?.meta_description || (row?.keywords?.length ?? 0) > 0);
  };
  // Progress across the whole tab, not the filtered list — the question is
  // how much of the catalogue has been written, and a search box should not
  // flatter the answer.
  const doneCount = items.filter(edited).length;
  const donePercent = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div>
      <h1 className="text-xl font-bold text-brand-ink md:text-2xl">SEO</h1>
      <p className="mt-1 text-sm text-slate-500">
        หัวข้อและคำอธิบายที่แสดงในผลค้นหา Google — เว้นว่างไว้ ระบบจะใช้ค่าที่สร้างให้อัตโนมัติ
      </p>

      <div className="mt-5 inline-flex rounded-full bg-surface-muted p-1">
        {SEO_PAGE_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setSelected(null);
              setQuery("");
            }}
            className={
              tab === t.key
                ? "rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-brand-ink shadow-card"
                : "rounded-full px-4 py-1.5 text-sm font-medium text-slate-500 hover:text-brand-ink"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "campaign" && (
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${donePercent}%` }} />
          </div>
          <span className="text-xs text-slate-500">
            ตั้งค่าแล้ว {doneCount.toLocaleString("th-TH")} จาก {items.length.toLocaleString("th-TH")} ({donePercent}%)
          </span>
        </div>
      )}

      {tab === "campaign" ? (
        <p className="mt-6 rounded-xl2 bg-surface-soft p-5 text-sm text-slate-500">
          หน้าแคมเปญ Flash Sale ถูกตั้งค่าไม่ให้ Google เก็บไว้ในผลค้นหา (เพราะปิดการขายแล้วจะกลายเป็นหน้าว่าง)
          การตั้งหัวข้อ SEO ให้แคมเปญจึงยังไม่มีผล จนกว่าจะทำหน้า landing ถาวรแยกต่างหาก
        </p>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหา…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal"
            />
            <ul className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto pr-1">
              {shown.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => open(item)}
                    className={
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm " +
                      (selected?.key === item.key ? "bg-brand-gradient-soft text-brand-ink" : "hover:bg-surface-soft")
                    }
                  >
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-surface-mist ring-1 ring-surface-line">
                      {item.image && (
                        <Image src={item.image} alt="" fill sizes="36px" className="object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {edited(item) ? (
                      <span
                        title="ตั้งค่า SEO แล้ว"
                        className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-800 text-white"
                      >
                        <Check size={12} aria-hidden="true" />
                      </span>
                    ) : (
                      <span
                        title="ยังใช้ค่าอัตโนมัติ"
                        className="size-5 shrink-0 rounded-full ring-1 ring-inset ring-surface-line"
                      />
                    )}
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">ไม่พบรายการ</li>}
            </ul>
          </div>

          {selected ? (
            <div className="min-w-0 rounded-xl2 bg-white p-5 ring-1 ring-surface-line">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-brand-ink">{selected.label}</h2>
                  <Link
                    href={selected.href}
                    target="_blank"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:underline"
                  >
                    {selected.href} <ExternalLink size={12} aria-hidden="true" />
                  </Link>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={suggest} disabled={thinking}>
                  <Sparkles size={14} aria-hidden="true" />
                  {thinking ? "กำลังคิด…" : "ให้ AI ช่วยคิด"}
                </Button>
              </div>

              <div className="mt-4 rounded-lg bg-surface-soft p-3">
                <p className="text-[11px] font-semibold text-slate-400">ค่าอัตโนมัติที่ใช้อยู่ตอนนี้</p>
                <p className="mt-1 text-sm text-brand-ink">{selected.autoTitle}</p>
                <p className="text-xs text-slate-500">{selected.autoDescription || "— ไม่มีคำอธิบาย —"}</p>
              </div>

              <label htmlFor="seo-title" className="mt-4 block text-sm font-semibold text-brand-ink">
                หัวข้อ (title)
              </label>
              <input
                id="seo-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เว้นว่าง = ใช้ค่าอัตโนมัติ"
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal"
              />
              <p className={"mt-1 text-xs " + (title.length > TITLE_MAX ? "text-amber-600" : "text-slate-400")}>
                {title.length}/{TITLE_MAX} ตัวอักษร
              </p>

              <label htmlFor="seo-desc" className="mt-3 block text-sm font-semibold text-brand-ink">
                คำอธิบาย (description)
              </label>
              <textarea
                id="seo-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="เว้นว่าง = ใช้ค่าอัตโนมัติ"
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal"
              />
              <p
                className={
                  "mt-1 text-xs " + (description.length > DESCRIPTION_MAX ? "text-amber-600" : "text-slate-400")
                }
              >
                {description.length}/{DESCRIPTION_MAX} ตัวอักษร
              </p>

              <label htmlFor="seo-keywords" className="mt-3 block text-sm font-semibold text-brand-ink">
                คำค้นหาที่อยากให้ติด
              </label>
              <input
                id="seo-keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="คั่นด้วยจุลภาค เช่น บิลเบอร์รี่ บำรุงสายตา, อาหารเสริมสายตา"
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal"
              />
              <p className="mt-1 text-xs text-slate-400">
                ใช้เป็นโจทย์ให้ AI เขียน และเป็นบันทึกว่าหน้านี้ตั้งใจจับคำไหน
              </p>

              {/* The angle is an editorial decision, not a tone setting: the
                  same product yields a different title depending on whether
                  the shopper is looking for the brand or for the problem. */}
              <fieldset className="mt-4 min-w-0">
                <legend className="text-sm font-semibold text-brand-ink">อยากให้ AI เน้นด้านไหน</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SEO_ANGLES.map((a) => {
                    const on = angles.includes(a.key);
                    return (
                      <label
                        key={a.key}
                        className={
                          "cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors " +
                          (on
                            ? "bg-brand-gradient-soft text-brand-800 ring-brand-action/40"
                            : "text-slate-600 ring-surface-line hover:bg-surface-soft")
                        }
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() =>
                            setAngles((prev) => (on ? prev.filter((k) => k !== a.key) : [...prev, a.key]))
                          }
                        />
                        {a.label}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-slate-400">ไม่เลือก = ให้ AI ตัดสินใจเอง</p>
              </fieldset>

              {suggestions.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold text-slate-400">
                    AI แนะนำ — ตรวจก่อนใช้เสมอ โดยเฉพาะข้อความที่อ้างสรรพคุณ
                  </p>
                  <ul className="mt-2 space-y-2">
                    {suggestions.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => {
                            setTitle(s.title);
                            setDescription(s.description);
                          }}
                          className="w-full rounded-lg border border-surface-line p-3 text-left hover:border-brand-action/40 hover:bg-surface-soft"
                        >
                          <span className="block text-sm font-semibold text-brand-ink">{s.title}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{s.description}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 flex items-center gap-3">
                <Button type="button" onClick={save} disabled={saving}>
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </Button>
                {note && <span className="text-xs text-slate-500">{note}</span>}
              </div>
            </div>
          ) : (
            <div className="grid min-h-[200px] place-items-center rounded-xl2 bg-surface-soft text-sm text-slate-400">
              เลือกรายการทางซ้ายเพื่อแก้ไข
            </div>
          )}
        </div>
      )}
    </div>
  );
}
