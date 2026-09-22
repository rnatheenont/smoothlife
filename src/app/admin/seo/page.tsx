"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, ExternalLink, Check, Image as ImageIcon, AlertTriangle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useAdminAction } from "@/components/admin/header-action";
import { categories, categoryImage, concerns } from "@/data/categories";
import { products } from "@/data/products";
import { collections } from "@/data/collections";
import { brands } from "@/data/brands";
import { brandFacts, brandSeoDefaults } from "@/lib/brand-seo";
import { SITE_PAGES } from "@/lib/site-pages";
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
  /** A search listing already written somewhere else — Shopify's own SEO
   *  fields for this product or post. Counts as written: the question the
   *  progress bar answers is whether a page has a hand-written listing at
   *  all, not whether it was typed into this particular screen. */
  written?: boolean;
  /** False when this page is canonicalised elsewhere, so what is typed here
   *  never reaches Google. Only the Shopify blog posts are like that. */
  editableHere?: boolean;
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
      image: categoryImage(c.slug),
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
  if (type === "collection") {
    return collections.map((c) => ({
      key: c.handle,
      label: c.title,
      image: c.image,
      href: `/collections/${c.handle}`,
      autoTitle: `${c.title} | Smoothlife.com`,
      autoDescription: c.description?.slice(0, 160) || `ช้อป ${c.title} ที่ Smoothlife.com`,
      context: `คอลเลกชัน: ${c.title}\nคำอธิบายที่มีอยู่: ${(c.description || "(ไม่มี)").slice(0, 1200)}`,
    }));
  }
  if (type === "brand") {
    return brands.map((b) => {
      const facts = brandFacts(b.slug);
      const auto = facts ? brandSeoDefaults(facts) : { title: `${b.name} | Smoothlife.com`, description: b.tagline };
      return {
        key: b.slug,
        label: b.name,
        sub: `${b.productCount} สินค้า`,
        image: b.image,
        href: `/brands/${b.slug}`,
        autoTitle: auto.title,
        autoDescription: auto.description,
        context:
          `หน้ารวมแบรนด์: ${b.name}\nคำอธิบายแบรนด์: ${b.tagline}\n` +
          `จำนวนสินค้าที่ขายอยู่: ${facts?.items.length ?? b.productCount} รายการ\n` +
          `หมวดสินค้าของแบรนด์นี้: ${facts?.categoryNames.join(", ") || "-"}\n` +
          `รีวิวรวม: ${facts?.reviews ?? 0} รายการ`,
      };
    });
  }
  if (type === "page") {
    return SITE_PAGES.map((p) => ({
      key: p.key,
      label: p.label,
      sub: p.path,
      image: null,
      href: p.path,
      autoTitle: p.title,
      autoDescription: p.description,
      context: `หน้าหลักของเว็บ: ${p.label} (${p.path})\nคำอธิบายปัจจุบัน: ${p.description}`,
    }));
  }
  // Articles are fetched, not imported: the blog posts live in Shopify and
  // carry the SEO fields the team already typed there. See the effect below.
  if (type === "article") return [];
  if (type === "product") {
    return products.slice(0, 1200).map((p) => ({
      key: p.slug,
      label: p.name,
      // Whether this product's search listing was written by someone or left
      // to the template is the first thing worth knowing about it, so it goes
      // where the eye already is rather than inside the editor.
      sub: p.seoTitle ? `${p.brand} · ตั้ง SEO ไว้ใน Shopify แล้ว` : p.brand,
      written: Boolean(p.seoTitle || p.seoDescription),
      image: p.image,
      href: `/product/${p.slug}`,
      autoTitle: p.seoTitle || `${p.name} | Smoothlife.com`,
      autoDescription: p.seoDescription || p.shortDesc || undefined,
      context:
        `สินค้า: ${p.name}\nแบรนด์: ${p.brand}\nหมวดหมู่: ${p.category}\nราคา: ${p.price} บาท\n` +
        `SEO ที่ตั้งไว้ใน Shopify: ${p.seoTitle ? `${p.seoTitle} / ${p.seoDescription || "(ไม่มีคำอธิบาย)"}` : "(ยังไม่ได้ตั้ง)"}\n` +
        `คำอธิบายที่มีอยู่: ${(p.description || p.shortDesc || "(ไม่มี)").slice(0, 1200)}`,
    }));
  }
  return [];
}

export default function AdminSeoPage() {
  const [tab, setTab] = useState<SeoPageType>("product");
  const [overrides, setOverrides] = useState<Record<string, SeoOverride>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "done" | "todo">("all");
  const [selected, setSelected] = useState<Item | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  // The picture a shared link shows. Empty means the page's own default —
  // its product photo, brand logo or category shot.
  const [ogImage, setOgImage] = useState("");
  const [angles, setAngles] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SeoSuggestion[]>([]);
  const [thinking, setThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [searches, setSearches] = useState<{ normalized: string; searches: number; zero_result_searches: number }[]>(
    [],
  );
  const [articleItems, setArticleItems] = useState<Item[] | null>(null);

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
    fetch("/api/admin/seo/searches?days=90")
      .then((r) => r.json())
      .then((d) => setSearches(d?.searches ?? []))
      .catch(() => setSearches([]));
  }, []);

  // Loaded once, the first time the tab is opened — it reaches out to
  // smoothlife.com for the blog feed, which is too slow to repeat on a click.
  useEffect(() => {
    if (tab !== "article" || articleItems !== null) return;
    fetch("/api/admin/seo/articles")
      .then((r) => r.json())
      .then((d) => setArticleItems(d?.articles ?? []))
      .catch(() => setArticleItems([]));
  }, [tab, articleItems]);

  const items = useMemo(() => (tab === "article" ? (articleItems ?? []) : itemsFor(tab)), [tab, articleItems]);
  const q = query.trim().toLowerCase();

  function open(item: Item) {
    const row = overrides[`${tab}:${item.key}`];
    setSelected(item);
    setTitle(row?.meta_title ?? "");
    setDescription(row?.meta_description ?? "");
    setKeywords((row?.keywords ?? []).join(", "));
    setOgImage(row?.og_image ?? "");
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
          keywords: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
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
          og_image: ogImage,
          keywords: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
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

  // How many pages each tab holds, so the size of a job is visible before
  // opening it. Computed once: itemsFor("product") walks the whole catalogue,
  // and the article tab only knows its count after the Shopify fetch lands.
  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        SEO_PAGE_TYPES.map((t) => [
          t.key,
          t.key === "article" ? (articleItems?.length ?? null) : itemsFor(t.key).length,
        ]),
      ) as Record<SeoPageType, number | null>,
    [articleItems],
  );

  /** Written on this screen — the only kind we can edit back. */
  const overridden = (item: Item) => {
    const row = overrides[`${tab}:${item.key}`];
    return Boolean(row?.meta_title || row?.meta_description || (row?.keywords?.length ?? 0) > 0);
  };

  /** Written anywhere: here, or in Shopify's own search-listing fields. */
  const edited = (item: Item) => overridden(item) || Boolean(item.written);

  // Working through 900 products means coming back to where you left off,
  // so "ยังไม่ตั้ง" is the list that matters most and gets its own filter
  // rather than being something to scroll past.
  const matching = items.filter(
    (i) =>
      (!q || `${i.label} ${i.sub ?? ""}`.toLowerCase().includes(q)) &&
      (filter === "all" || (filter === "done" ? edited(i) : !edited(i))),
  );
  // Every match, not the first 200: the list is the worklist, and a cap on
  // it meant the only way to reach product 600 was to already know its name.
  // The rows are cheap (one lazy thumbnail each) and the pane scrolls.
  const shown = matching;

  // The editor filled two thirds of the screen with one line of grey text
  // until something was clicked. Opening the first row is what the person was
  // about to do anyway; it only ever runs when nothing is open, so it cannot
  // take over an edit in progress.
  useEffect(() => {
    if (!selected && shown.length > 0) open(shown[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open() reads the row for the current tab
  }, [selected, shown]);
  // The typed URL wins; otherwise the page's own picture is what a share
  // would really show today, which is the thing worth previewing.
  const previewImage = ogImage.trim() || selected?.image || "";
  // Progress across the whole tab, not the filtered list — the question is
  // how much of the catalogue has been written, and a search box should not
  // flatter the answer.
  const doneCount = items.filter(edited).length;
  const donePercent = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div>
      <h1 className="text-xl font-bold text-brand-ink md:text-2xl">SEO หน้าเว็บ</h1>
      <p className="mt-1 text-sm text-slate-500">
        หัวข้อและคำอธิบายที่แสดงในผลค้นหา Google — เว้นว่างไว้ ระบบจะใช้ค่าที่สร้างให้อัตโนมัติ
      </p>

      {/* Scrolls sideways rather than wrapping: eight pills with counts
          no longer fit a laptop width, and a label broken across two lines
          ("คอลเลก / ชัน") is harder to read than a row you can swipe. */}
      <div className="mt-5 flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-surface-muted p-1 scrollbar-none">
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
              "shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm " +
              (tab === t.key
                ? "bg-white font-semibold text-brand-ink shadow-card"
                : "font-medium text-slate-500 hover:text-brand-ink")
            }
          >
            {t.label}
            {tabCounts[t.key] !== null && (
              <span className={tab === t.key ? "ml-1.5 text-xs text-slate-500" : "ml-1.5 text-xs text-slate-400"}>
                {tabCounts[t.key]?.toLocaleString("th-TH")}
              </span>
            )}
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
        // 21rem is what actually sits above this on screen — breadcrumb,
        // heading, the tab row and the progress bar. The old 15rem was a
        // guess from before the tabs carried counts, and it pushed the
        // editor's bottom edge (and the Save button on it) past the fold.
        <div className="mt-6 grid min-h-0 gap-5 lg:h-[calc(100dvh-21rem)] lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
          <div className="flex min-h-0 min-w-0 flex-col">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อสินค้าหรือแบรนด์…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal"
            />
            <div className="mt-2 inline-flex rounded-full bg-surface-muted p-1 text-xs">
              {(
                [
                  ["all", `ทั้งหมด ${items.length.toLocaleString("th-TH")}`],
                  ["todo", `ยังไม่ตั้ง ${(items.length - doneCount).toLocaleString("th-TH")}`],
                  ["done", `ตั้งแล้ว ${doneCount.toLocaleString("th-TH")}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={
                    filter === key
                      ? "flex-1 rounded-full bg-white px-3 py-1.5 font-semibold text-brand-ink shadow-card"
                      : "flex-1 rounded-full px-3 py-1.5 font-medium text-slate-500 hover:text-brand-ink"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {shown.map((item, i) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => open(item)}
                    className={
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm " +
                      (selected?.key === item.key ? "bg-brand-gradient-soft text-brand-ink" : "hover:bg-surface-soft")
                    }
                  >
                    {/* Position in the list, so "ทำถึงไหนแล้ว" has an answer
                        that does not need counting — and so a row can be
                        named out loud ("อันที่ 412") when two products have
                        nearly the same title. */}
                    <span className="w-9 shrink-0 text-center text-xs tabular-nums text-slate-400">
                      {(i + 1).toLocaleString("th-TH")}
                    </span>
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-surface-mist ring-1 ring-surface-line">
                      {item.image && <Image src={item.image} alt="" fill sizes="36px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      {/* Two lines rather than one: "(Deal Duo) Dentiste
                          Extra Fresh 15…" and "(Deal Duo) Dentiste Hygienic
                          Brea…" are different products that truncated to the
                          same thing. */}
                      <span className="block line-clamp-2 leading-snug">{item.label}</span>
                      {item.sub && <span className="block truncate text-[11px] text-slate-400">{item.sub}</span>}
                    </span>
                    {/* Three states, not two: written here, written in
                        Shopify, or written nowhere. The middle one is the
                        common case for products and is worth telling apart —
                        it is the listing you would go to Shopify to change. */}
                    {overridden(item) ? (
                      <span
                        title="ตั้งค่า SEO ในหน้านี้แล้ว"
                        className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-800 text-white"
                      >
                        <Check size={12} aria-hidden="true" />
                      </span>
                    ) : item.written ? (
                      <span
                        title="ใช้ค่า SEO ที่ตั้งไว้ใน Shopify"
                        className="grid size-5 shrink-0 place-items-center rounded-full text-brand-800 ring-1 ring-inset ring-brand-800/40"
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
              {tab === "article" && articleItems === null && (
                <li className="px-3 py-2 text-sm text-slate-400">กำลังดึงบทความจาก Shopify…</li>
              )}
              {shown.length === 0 && !(tab === "article" && articleItems === null) && (
                <li className="px-3 py-2 text-sm text-slate-400">ไม่พบรายการ</li>
              )}
              {shown.length > 0 && (
                <li className="px-3 py-3 text-center text-xs text-slate-400">
                  ครบ {shown.length.toLocaleString("th-TH")} รายการ
                </li>
              )}
            </ul>
          </div>

          {selected ? (
            <div className="flex min-h-0 min-w-0 flex-col rounded-xl2 bg-white ring-1 ring-surface-line">
              <div className="flex items-start justify-between gap-3 border-b border-surface-line p-5 pb-4">
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

              {/* Saying so here is the whole point: without it this screen
                  invites someone to write a title that Google will never
                  read, and nothing on the page would ever tell them. */}
              {selected.editableHere === false && (
                <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    บทความนี้อยู่บน Shopify และหน้านี้ชี้ canonical กลับไปที่ smoothlife.com — Google
                    จะอ่านหัวข้อจากฝั่ง Shopify ไม่ใช่ที่นี่ ถ้าจะแก้ให้มีผลกับผลค้นหา ต้องไปแก้ในช่อง SEO
                    ของบทความนั้นใน Shopify
                  </span>
                </div>
              )}

              {/* Fields on the left, previews on the right — the two things
                  you look at while typing, so neither should be a scroll
                  away from the other. Stacked below 1280px with the previews
                  first, which is the only order that fits a narrow pane. */}
              <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 xl:grid-cols-[minmax(0,1fr)_520px]">
                <div className="min-w-0 xl:order-2">
                  {/* What Google will actually show. The boxes below are abstract
                  until you can see the result they produce — and the line
                  that gets truncated is obvious here and nowhere else. */}
                  <div className="mt-4 rounded-xl2 bg-surface-soft p-4">
                    <p className="mb-2 text-[11px] font-semibold text-slate-400">
                      ตัวอย่างที่จะแสดงใน Google {title || description ? "(ค่าที่ตั้งเอง)" : "(ค่าอัตโนมัติ)"}
                    </p>
                    <div className="rounded-lg bg-white p-3">
                      <p className="truncate text-xs text-slate-500">smoothlife.com{selected.href}</p>
                      <p className="mt-0.5 line-clamp-1 text-[17px] leading-snug text-[#1a0dab]">
                        {title || selected.autoTitle}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-slate-600">
                        {description ||
                          selected.autoDescription ||
                          "— ยังไม่มีคำอธิบาย Google จะหยิบข้อความจากหน้าเว็บมาแสดงเอง —"}
                      </p>
                    </div>
                  </div>

                  {/* Two previews because they are two different results. Google
                  shows a line of text; LINE and Facebook show a picture first
                  and the words second — and the picture is the part nobody
                  can see until the link is already shared. */}
                  <div className="mt-3 rounded-xl2 bg-surface-soft p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                      <ImageIcon size={12} aria-hidden="true" />
                      ตัวอย่างตอนแชร์ลิงก์ (LINE / Facebook) {ogImage ? "(รูปที่ตั้งเอง)" : "(รูปอัตโนมัติ)"}
                    </p>
                    {/* Fills its column — 520px, about what a share card gets
                        in a desktop feed. The cap that used to be here was
                        fighting the old full-width layout, where the 1.91:1
                        box grew as tall as the pane is wide; in a column of
                        its own, the column is the cap. */}
                    <div className="overflow-hidden rounded-lg bg-white ring-1 ring-surface-line">
                      <div className="relative aspect-[1.91/1] bg-surface-mist">
                        {previewImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={previewImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="absolute inset-0 grid place-items-center text-xs text-slate-400">
                            หน้านี้ยังไม่มีรูป — จะใช้โลโก้เว็บแทน
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="truncate text-[11px] uppercase text-slate-400">smoothlife.com</p>
                        <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-brand-ink">
                          {title || selected.autoTitle}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {description || selected.autoDescription || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 xl:order-1">
                  {/* The counter rides on the label rather than taking a line of
                  its own under every field — six fields, six saved lines. */}
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor="seo-title" className="text-sm font-semibold text-brand-ink">
                      หัวข้อ (title)
                    </label>
                    <span className={"text-xs " + (title.length > TITLE_MAX ? "text-amber-600" : "text-slate-400")}>
                      {title.length}/{TITLE_MAX}
                    </span>
                  </div>
                  <input
                    id="seo-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เว้นว่าง = ใช้ค่าอัตโนมัติ"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal"
                  />

                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <label htmlFor="seo-desc" className="text-sm font-semibold text-brand-ink">
                      คำอธิบาย (description)
                    </label>
                    <span
                      className={
                        "text-xs " + (description.length > DESCRIPTION_MAX ? "text-amber-600" : "text-slate-400")
                      }
                    >
                      {description.length}/{DESCRIPTION_MAX}
                    </span>
                  </div>
                  <textarea
                    id="seo-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="เว้นว่าง = ใช้ค่าอัตโนมัติ"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal"
                  />
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

                  <label htmlFor="seo-og" className="mt-3 block text-sm font-semibold text-brand-ink">
                    รูปตอนแชร์ลิงก์ (thumbnail)
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="seo-og"
                      value={ogImage}
                      onChange={(e) => setOgImage(e.target.value)}
                      placeholder="เว้นว่าง = ใช้รูปของหน้านั้น"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal"
                    />
                    {selected.image && selected.image !== ogImage && (
                      <button
                        type="button"
                        onClick={() => setOgImage(selected.image as string)}
                        className="shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-brand-800 hover:bg-surface-soft"
                      >
                        ใช้รูปนี้
                      </button>
                    )}
                    {ogImage && (
                      <button
                        type="button"
                        onClick={() => setOgImage("")}
                        className="shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-500 hover:bg-surface-soft"
                      >
                        ล้าง
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    ต้องเป็นลิงก์เต็มขึ้นต้นด้วย https:// — สัดส่วนที่ LINE และ Facebook ครอบคือ 1.91:1 (แนะนำ 1200×630
                    px) รูปสินค้าเป็นสี่เหลี่ยมจัตุรัส เวลาแชร์จะโดนครอบบน-ล่าง
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

                  {/* No keyword tool is connected, and a made-up volume number is
                  worse than none. These are the shop's own visitors — fewer
                  people than a search engine sees, but every one of them was
                  already here meaning to buy. A query that found nothing is
                  the most useful row on the list. */}
                  {searches.length > 0 && (
                    <div className="mt-5">
                      <p className="text-xs font-semibold text-slate-400">
                        คนค้นอะไรในเว็บ (90 วันล่าสุด) — แตะเพื่อใส่เป็นคำค้นหา
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {searches.slice(0, 12).map((row) => (
                          <button
                            key={row.normalized}
                            type="button"
                            onClick={() =>
                              setKeywords((prev) =>
                                prev.trim() ? `${prev.replace(/,\s*$/, "")}, ${row.normalized}` : row.normalized,
                              )
                            }
                            title={
                              row.zero_result_searches > 0
                                ? `ค้น ${row.searches} ครั้ง · ไม่เจอผลลัพธ์ ${row.zero_result_searches} ครั้ง`
                                : `ค้น ${row.searches} ครั้ง`
                            }
                            className={
                              "rounded-full px-2.5 py-1 text-xs ring-1 transition-colors hover:bg-surface-soft " +
                              (row.zero_result_searches > 0
                                ? "text-amber-700 ring-amber-200"
                                : "text-slate-600 ring-surface-line")
                            }
                          >
                            {row.normalized} <span className="text-slate-400">{row.searches}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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
                </div>
              </div>

              {/* Pinned, not scrolled to: with the previews and six fields
                  above it, Save used to sit below the fold on every page. */}
              <div className="flex items-center gap-3 border-t border-surface-line p-5 py-3">
                <Button type="button" onClick={save} disabled={saving}>
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </Button>
                {note && <span className="text-xs text-slate-500">{note}</span>}
              </div>
            </div>
          ) : (
            <div className="grid min-h-[200px] place-items-center rounded-xl2 bg-surface-soft px-6 text-center text-sm text-slate-400">
              {shown.length === 0 ? "ไม่มีรายการในตัวกรองนี้" : "เลือกรายการทางซ้ายเพื่อแก้ไข"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
