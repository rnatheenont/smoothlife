"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Button, Card } from "@heroui/react";
import { Check, Search } from "lucide-react";
import { formatTHB } from "@/lib/format";
import { MAX_GROUP_PRODUCTS, SPECIAL_ACCENT_DEFAULT, type CampaignConfig, type DemoProduct } from "./campaign";
import { fromLocalInput, toLocalInput } from "./scheduler";

export type CatalogueItem = DemoProduct & { category: string; brandSlug: string };
export type ProductGroup = { id: string; kind: "category" | "brand" | "collection"; label: string; slugs: string[] };

const KIND_LABEL: Record<ProductGroup["kind"], string> = {
  category: "หมวดหมู่",
  brand: "แบรนด์",
  collection: "คอลเลกชัน",
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className={`inline-flex rounded-full bg-surface-muted p-1 ${disabled ? "opacity-60" : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`min-h-9 rounded-full px-4 text-sm font-semibold transition disabled:cursor-not-allowed ${
            value === o.value ? "bg-white text-brand-ink shadow-card" : "text-slate-600 hover:text-brand-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const fieldBase = "min-h-11 rounded-xl2 border border-surface-line bg-white px-3 text-sm text-brand-ink focus:border-brand-800 focus:outline-none";
const fieldClass = `${fieldBase} w-full`;

/** A stored campaign being edited, and how much of it may still change. */
export type EditingCampaign = {
  id: string;
  title: string;
  startsAt: number;
  endsAt?: number;
  salePrices: Record<string, number | null>;
  /** "limited": it has opened (or someone has queued) — only the page, the
   *  title and the closing time may still move. */
  scope: "full" | "limited";
};

/**
 * Admin side of the demo: pick what the flash sale sells — one product, or a
 * whole group (category, brand or Shopify collection) — and the per-sale
 * settings, then restart the simulation with it. In the real system this is
 * the form that inserts `flash_sale` rows (plan §0), one per product.
 *
 * The same form edits a stored campaign: the caller passes `editing` and
 * remounts it (key={id}) so every field starts from what is stored.
 */
export default function CampaignSetup({
  config,
  catalogue,
  groups,
  now,
  onCreate,
  saving = false,
  editing,
  onCancelEdit,
}: {
  config: CampaignConfig;
  catalogue: CatalogueItem[];
  groups: ProductGroup[];
  /** Demo clock (epoch ms) — new campaigns default to starting 10 minutes from it. */
  now: number;
  onCreate: (config: CampaignConfig, startsAt: number, endsAt?: number) => void | Promise<unknown>;
  /** Saving to the database; the button waits for it. */
  saving?: boolean;
  editing?: EditingCampaign;
  onCancelEdit?: () => void;
}) {
  const locked = editing?.scope === "limited";
  const [mode, setMode] = useState<CampaignConfig["mode"]>(config.mode);
  const [query, setQuery] = useState("");
  const [productSlug, setProductSlug] = useState(config.products[0]?.slug ?? catalogue[0]?.slug);
  const [kind, setKind] = useState<ProductGroup["kind"]>(config.group?.kind ?? "brand");
  const kindGroups = useMemo(() => groups.filter((g) => g.kind === kind), [groups, kind]);
  const [groupId, setGroupId] = useState<string>(
    () => config.group?.key ?? groups.find((g) => g.kind === (config.group?.kind ?? "brand"))?.id ?? groups[0]?.id ?? ""
  );
  const [stock, setStock] = useState(config.stockPerProduct);
  const [windowMinutes, setWindowMinutes] = useState(config.windowMinutes);
  const [maxRequeue, setMaxRequeue] = useState(config.maxRequeue);
  const [pageKind, setPageKind] = useState<"regular" | "special">(config.kind ?? "regular");
  const [heroImage, setHeroImage] = useState(config.presentation?.heroImage ?? "");
  const [heroHeadline, setHeroHeadline] = useState(config.presentation?.heroHeadline ?? "");
  const [heroNote, setHeroNote] = useState(config.presentation?.heroNote ?? "");
  const [heroAlign, setHeroAlign] = useState<"top" | "center" | "bottom">(config.presentation?.heroAlign ?? "top");
  const [accent, setAccent] = useState(config.presentation?.accent ?? SPECIAL_ACCENT_DEFAULT);
  const [faq, setFaq] = useState<{ q: string; a: string }[]>(config.presentation?.faq ?? []);
  // An edited campaign keeps the exact prices it was saved with, so they come
  // back as "กำหนดเอง" whatever they were set with the first time.
  const storedPrices = editing?.salePrices ?? {};
  const hasStoredPrice = Object.values(storedPrices).some((v) => v !== null && v !== undefined);
  const [priceMode, setPriceMode] = useState<"regular" | "percent" | "fixed">(editing ? (hasStoredPrice ? "fixed" : "regular") : "percent");
  const [percent, setPercent] = useState(20);
  const [fixedPrices, setFixedPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(storedPrices).filter(([, v]) => v !== null && v !== undefined).map(([slug, v]) => [slug, String(v)]))
  );
  const [titleInput, setTitleInput] = useState(editing?.title ?? "");
  const [startInput, setStartInput] = useState(() => toLocalInput(editing?.startsAt ?? Math.ceil((now + 10 * 60_000) / 60_000) * 60_000));
  const [hasEnd, setHasEnd] = useState(editing ? editing.endsAt !== undefined : true);
  const [endInput, setEndInput] = useState(() => toLocalInput(editing?.endsAt ?? Math.ceil((now + 130 * 60_000) / 60_000) * 60_000));
  const startsAt = startInput ? fromLocalInput(startInput) : NaN;
  const endsAt = hasEnd && endInput ? fromLocalInput(endInput) : undefined;
  const timeError = Number.isNaN(startsAt)
    ? "กรุณาเลือกวันเวลาเริ่มขาย"
    : endsAt !== undefined && endsAt <= startsAt
      ? "เวลาปิดการขายต้องหลังเวลาเริ่มขาย"
      : null;

  const bySlug = useMemo(() => new Map(catalogue.map((p) => [p.slug, p])), [catalogue]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? catalogue.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)) : catalogue;
    return list.slice(0, 8);
  }, [catalogue, query]);

  const group = kindGroups.find((g) => g.id === groupId) ?? kindGroups[0];
  const groupProducts = useMemo(
    () => (group ? group.slugs.map((s) => bySlug.get(s)).filter((p): p is CatalogueItem => Boolean(p)) : []),
    [group, bySlug]
  );
  const selectedProduct = productSlug ? bySlug.get(productSlug) : undefined;

  const products = mode === "single" ? (selectedProduct ? [selectedProduct] : []) : groupProducts.slice(0, MAX_GROUP_PRODUCTS);
  const autoTitle = mode === "single" ? `Flash Sale · ${selectedProduct?.name ?? ""}` : `Flash Sale ${KIND_LABEL[kind]} ${group?.label ?? ""}`;
  const title = titleInput.trim() || autoTitle;
  // Flash price per product as it will be charged (the server recomputes and
  // checks the same rules; this is the preview).
  const salePriceOf = (p: CatalogueItem): number | null => {
    if (priceMode === "regular") return null;
    if (priceMode === "percent") return Math.max(1, Math.round(p.price * (1 - percent / 100)));
    const v = Number(fixedPrices[p.slug]);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const priceError =
    priceMode === "percent" && (!Number.isFinite(percent) || percent < 1 || percent > 90)
      ? "ส่วนลดต้องอยู่ระหว่าง 1–90%"
      : priceMode === "fixed" && products.some((p) => salePriceOf(p) === null)
        ? "กรอกราคา Flash Sale ให้ครบทุกสินค้า"
        : priceMode === "fixed" && products.some((p) => (salePriceOf(p) ?? 0) > p.price)
          ? "ราคา Flash Sale ต้องไม่สูงกว่าราคาปกติ"
          : null;
  // A banner has to come from our own site or Shopify's CDN (the server checks
  // the same thing — src/lib/flash-sale-campaigns.ts).
  const heroError =
    pageKind === "special" && heroImage.trim() && !/^\/|^https:\/\/(cdn\.shopify\.com|(www\.)?smoothlife\.com)\//.test(heroImage.trim())
      ? "แบนเนอร์ต้องเป็นลิงก์ https จาก cdn.shopify.com หรือ smoothlife.com"
      : null;
  const canCreate = products.length > 0 && stock >= 1 && !timeError && !priceError && !heroError;
  const presentation =
    pageKind === "special"
      ? {
          heroImage: heroImage.trim() || undefined,
          heroHeadline: heroHeadline.trim() || undefined,
          heroNote: heroNote.trim() || undefined,
          heroAlign,
          accent,
          faq: faq.filter((f) => f.q.trim() && f.a.trim()),
        }
      : undefined;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-brand-ink">{editing ? "แก้ไขแคมเปญ" : "สร้างแคมเปญใหม่"}</h3>
          <p className="text-sm text-slate-500">
            {editing
              ? locked
                ? "แคมเปญนี้เริ่มขายแล้ว แก้ได้เฉพาะชื่อ เวลาปิดการขาย และหน้าตาหน้าขาย"
                : "ยังไม่ถึงเวลาเริ่มขาย แก้ไขได้ทุกอย่าง"
              : "เลือกสินค้า ตั้งวันเวลา แล้วเพิ่มเข้ารายการ ระบบจะเปิดและปิดการขายให้เองตามเวลา"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented<CampaignConfig["mode"]>
            label="ประเภทแคมเปญ"
            value={mode}
            disabled={locked}
            onChange={setMode}
            options={[
              { value: "single", label: "สินค้าชิ้นเดียว" },
              { value: "group", label: "กลุ่มสินค้า" },
            ]}
          />
          <Segmented<"regular" | "special">
            label="หน้าขาย"
            value={pageKind}
            onChange={setPageKind}
            options={[
              { value: "regular", label: "แคมเปญธรรมดา" },
              { value: "special", label: "แคมเปญพิเศษ" },
            ]}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {mode === "single" ? (
          <div>
            <label htmlFor="fs-search" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              ค้นหาสินค้า
            </label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                id="fs-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ชื่อสินค้า หรือแบรนด์"
                className={`${fieldClass} pl-9`}
              />
            </div>
            <ul className="mt-3 flex flex-col gap-1.5" aria-label="ผลการค้นหา">
              {matches.map((p) => {
                const isSel = p.slug === productSlug;
                return (
                  <li key={p.slug}>
                    <button
                      type="button"
                      onClick={() => setProductSlug(p.slug)}
                      disabled={locked}
                      aria-pressed={isSel}
                      className={`flex w-full items-center gap-3 rounded-xl2 p-2 text-left ring-1 transition ${
                        isSel ? "bg-brand-50 ring-brand-800" : "ring-transparent hover:bg-surface-mist"
                      }`}
                    >
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-surface-line">
                        <Image src={p.image} alt="" fill sizes="44px" className="object-contain p-1" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm text-brand-ink">{p.name}</span>
                        <span className="text-xs text-slate-500">
                          {p.brand} · {formatTHB(p.price)}
                        </span>
                      </span>
                      {isSel && <Check size={18} className="shrink-0 text-brand-800" aria-hidden />}
                    </button>
                  </li>
                );
              })}
              {matches.length === 0 && <li className="py-4 text-center text-sm text-slate-500">ไม่พบสินค้าที่ตรงกับคำค้น</li>}
            </ul>
          </div>
        ) : (
          <div>
            <p className="mb-1.5 text-sm font-semibold text-brand-ink">เลือกกลุ่มจาก</p>
            <Segmented<ProductGroup["kind"]>
              label="ชนิดกลุ่ม"
              value={kind}
              disabled={locked}
              onChange={(k) => {
                setKind(k);
                setGroupId(groups.find((g) => g.kind === k)?.id ?? "");
              }}
              options={[
                { value: "category", label: "หมวดหมู่" },
                { value: "brand", label: "แบรนด์" },
                { value: "collection", label: "คอลเลกชัน" },
              ]}
            />
            <label htmlFor="fs-group" className="mb-1.5 mt-4 block text-sm font-semibold text-brand-ink">
              {KIND_LABEL[kind]}
            </label>
            <select id="fs-group" value={group?.id ?? ""} disabled={locked} onChange={(e) => setGroupId(e.target.value)} className={fieldClass}>
              {kindGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label} ({g.slugs.length} สินค้า)
                </option>
              ))}
            </select>
            <p className="mt-3 text-sm text-slate-600">
              สินค้าในกลุ่ม {groupProducts.length} รายการ
              {groupProducts.length > MAX_GROUP_PRODUCTS && ` · เดโมใช้ ${MAX_GROUP_PRODUCTS} รายการแรก`}
            </p>
            <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {products.map((p) => (
                <li key={p.slug} className="relative aspect-square overflow-hidden rounded-lg bg-white ring-1 ring-surface-line" title={p.name}>
                  <Image src={p.image} alt={p.name} fill sizes="80px" className="object-contain p-1" />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="fs-title" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              ชื่อแคมเปญ
            </label>
            <input
              id="fs-title"
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder={autoTitle}
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-slate-500">เว้นว่างไว้ระบบจะตั้งชื่อให้จากสินค้าที่เลือก</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <div>
              <label htmlFor="fs-start" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                เริ่มขาย
              </label>
              <input
                id="fs-start"
                type="datetime-local"
                value={startInput}
                disabled={locked}
                onChange={(e) => setStartInput(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="fs-end" className="text-sm font-semibold text-brand-ink">
                  ปิดการขาย
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={!hasEnd} onChange={(e) => setHasEnd(!e.target.checked)} className="accent-brand-800" />
                  จนกว่าของหมด
                </label>
              </div>
              <input
                id="fs-end"
                type="datetime-local"
                value={endInput}
                disabled={!hasEnd}
                onChange={(e) => setEndInput(e.target.value)}
                className={`${fieldClass} disabled:bg-surface-muted disabled:text-slate-400`}
              />
            </div>
          </div>
          {timeError && (
            <p role="alert" className="-mt-2 text-sm text-rose-600">
              {timeError}
            </p>
          )}
          <fieldset className="rounded-xl2 border border-surface-line p-3">
            <legend className="px-1 text-sm font-semibold text-brand-ink">ราคา Flash Sale</legend>
            <Segmented<"regular" | "percent" | "fixed">
              label="วิธีตั้งราคา"
              value={priceMode}
              disabled={locked}
              onChange={setPriceMode}
              options={[
                { value: "percent", label: "ลด %" },
                { value: "fixed", label: "กำหนดเอง" },
                { value: "regular", label: "ราคาปกติ" },
              ]}
            />
            {priceMode === "percent" && (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                <label htmlFor="fs-percent" className="text-sm text-slate-600">
                  ลด
                </label>
                <span className="relative">
                  <input
                    id="fs-percent"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={90}
                    value={percent}
                    disabled={locked}
                    onChange={(e) => setPercent(Number(e.target.value))}
                    className={`${fieldBase} w-24 pr-7 text-right tabular-nums`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
                </span>
                <span className="text-sm text-slate-600">จากราคาปกติ ทุกสินค้า (ปัดเป็นบาท)</span>
              </div>
            )}
            {priceMode !== "regular" && products.length > 0 && (
              <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
                {products.map((p) => {
                  const sale = salePriceOf(p);
                  return (
                    <li key={p.slug} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-slate-700" title={p.name}>
                        {p.name}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400 line-through">{formatTHB(p.price)}</span>
                      {priceMode === "fixed" ? (
                        <span className="relative shrink-0">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">฿</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={1}
                            aria-label={`ราคา Flash Sale ${p.name}`}
                            value={fixedPrices[p.slug] ?? ""}
                            disabled={locked}
                            onChange={(e) => setFixedPrices((m) => ({ ...m, [p.slug]: e.target.value }))}
                            placeholder="0"
                            className={`${fieldBase} min-h-9 w-24 pl-6 text-right tabular-nums`}
                          />
                        </span>
                      ) : (
                        <span className="w-20 shrink-0 text-right font-semibold text-sale">{sale !== null ? formatTHB(sale) : "-"}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {priceError && (
              <p role="alert" className="mt-2 text-sm text-rose-600">
                {priceError}
              </p>
            )}
          </fieldset>

          {pageKind === "special" && (
            <fieldset className="flex flex-col gap-3 rounded-xl2 border border-surface-line p-3">
              <legend className="px-1 text-sm font-semibold text-brand-ink">หน้าขายแบบพิเศษ</legend>
              <p className="text-xs text-slate-500">
                หน้าขายจะเป็นแบบจองบัตรคอนเสิร์ต: แบนเนอร์เต็มจอ นับถอยหลังตัวใหญ่ แล้วค่อยเข้าคิว — ใช้กับคอลเลกชันพิเศษอย่าง KENG x NAMPING
              </p>
              <div>
                <label htmlFor="fs-hero" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                  ลิงก์รูปแบนเนอร์ (แนวนอน 1440×480)
                </label>
                <input
                  id="fs-hero"
                  type="url"
                  value={heroImage}
                  onChange={(e) => setHeroImage(e.target.value)}
                  placeholder="https://cdn.shopify.com/…/keng-namping.jpg"
                  className={fieldClass}
                />
                {heroError ? (
                  <p role="alert" className="mt-1 text-xs text-rose-600">
                    {heroError}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">อัปโหลดไฟล์ไว้ใน Shopify → Content → Files แล้ววางลิงก์ที่นี่ ถ้าเว้นว่างจะใช้รูปสินค้าแทน</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="fs-headline" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                    พาดหัวบนแบนเนอร์
                  </label>
                  <input
                    id="fs-headline"
                    type="text"
                    value={heroHeadline}
                    onChange={(e) => setHeroHeadline(e.target.value)}
                    placeholder="KENG NAMPING"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="fs-accent" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                    สีหลักของหน้า
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="fs-accent"
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      className="h-11 w-14 shrink-0 cursor-pointer rounded-xl2 border border-surface-line bg-white p-1"
                    />
                    <input
                      type="text"
                      aria-label="รหัสสีหลัก"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      className={`${fieldBase} w-28 uppercase`}
                    />
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-brand-ink">ตำแหน่งข้อความบนแบนเนอร์</p>
                <Segmented<"top" | "center" | "bottom">
                  label="ตำแหน่งข้อความบนแบนเนอร์"
                  value={heroAlign}
                  onChange={setHeroAlign}
                  options={[
                    { value: "top", label: "บน" },
                    { value: "center", label: "กลาง" },
                    { value: "bottom", label: "ล่าง" },
                  ]}
                />
                <p className="mt-1 text-xs text-slate-500">เลือกให้ข้อความไม่ทับหน้าแบบหรือตัวสินค้าในรูป</p>
              </div>
              <div>
                <label htmlFor="fs-note" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                  ข้อความใต้พาดหัว
                </label>
                <input
                  id="fs-note"
                  type="text"
                  value={heroNote}
                  onChange={(e) => setHeroNote(e.target.value)}
                  placeholder="Exclusive Online · 07.09.2026"
                  className={fieldClass}
                />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-brand-ink">คำถามที่พบบ่อย (Q&amp;A)</p>
                <ul className="flex flex-col gap-2">
                  {faq.map((row, i) => (
                    <li key={i} className="flex flex-col gap-1.5 rounded-xl2 bg-surface-soft p-2.5">
                      <input
                        type="text"
                        aria-label={`คำถามข้อ ${i + 1}`}
                        value={row.q}
                        onChange={(e) => setFaq((list) => list.map((f, j) => (i === j ? { ...f, q: e.target.value } : f)))}
                        placeholder="คำถาม"
                        className={`${fieldBase} min-h-9 w-full font-semibold`}
                      />
                      <textarea
                        aria-label={`คำตอบข้อ ${i + 1}`}
                        value={row.a}
                        rows={2}
                        onChange={(e) => setFaq((list) => list.map((f, j) => (i === j ? { ...f, a: e.target.value } : f)))}
                        placeholder="คำตอบ"
                        className={`${fieldClass} py-2`}
                      />
                      <button
                        type="button"
                        onClick={() => setFaq((list) => list.filter((_, j) => j !== i))}
                        className="self-end text-xs font-semibold text-rose-600 hover:underline"
                      >
                        ลบข้อนี้
                      </button>
                    </li>
                  ))}
                </ul>
                {faq.length < 20 && (
                  <Button size="sm" variant="ghost" className="mt-2" onPress={() => setFaq((list) => [...list, { q: "", a: "" }])}>
                    + เพิ่มคำถาม
                  </Button>
                )}
              </div>
            </fieldset>
          )}

          <div>
            <label htmlFor="fs-stock" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              สต็อกต่อสินค้า (ชิ้น)
            </label>
            <input
              id="fs-stock"
              type="number"
              inputMode="numeric"
              disabled={locked}
              min={1}
              max={200}
              value={stock}
              onChange={(e) => setStock(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fs-window" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                เวลาชำระเงิน
              </label>
              <select id="fs-window" disabled={locked} value={windowMinutes} onChange={(e) => setWindowMinutes(Number(e.target.value))} className={fieldClass}>
                {[5, 10, 15, 30].map((m) => (
                  <option key={m} value={m}>
                    {m} นาที
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fs-requeue" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                กลับเข้าคิวได้
              </label>
              <select id="fs-requeue" disabled={locked} value={maxRequeue} onChange={(e) => setMaxRequeue(Number(e.target.value))} className={fieldClass}>
                {[0, 1, 2, 3, 5].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "ไม่ได้" : `${n} ครั้ง`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="rounded-xl2 bg-surface-soft p-3 text-sm text-slate-600">
            <p className="font-semibold text-brand-ink">{products.length} สินค้า · รวม {products.length * stock} ชิ้น</p>
            <p className="mt-0.5 text-xs">1 บัญชีซื้อได้ 1 ชิ้นต่อแคมเปญ · เวลาไทย (GMT+7) · ระบบจริงสร้างรายการขาย 1 แถวต่อสินค้า</p>
          </div>
          <div className="flex gap-2">
            {editing && (
              <Button size="lg" variant="ghost" isDisabled={saving} onPress={onCancelEdit}>
                ยกเลิก
              </Button>
            )}
            <Button
              size="lg"
              fullWidth
              isDisabled={!canCreate || saving}
              isPending={saving}
              onPress={() =>
              onCreate(
                {
                  mode,
                  kind: pageKind,
                  presentation,
                  title,
                  // Demo shows the flash price, with the regular price struck through.
                  products: products.map((p) => {
                    const sale = salePriceOf(p);
                    return {
                      slug: p.slug,
                      name: p.name,
                      brand: p.brand,
                      image: p.image,
                      price: sale ?? p.price,
                      compareAtPrice: sale !== null ? Math.max(p.price, p.compareAtPrice ?? 0) : p.compareAtPrice,
                    };
                  }),
                  stockPerProduct: stock,
                  windowMinutes,
                  maxRequeue,
                  group: mode === "group" && group ? { kind, key: group.id } : undefined,
                  pricing:
                    priceMode === "regular"
                      ? { mode: "regular" }
                      : priceMode === "percent"
                        ? { mode: "percent", percent }
                        : { mode: "fixed", prices: Object.fromEntries(products.map((p) => [p.slug, salePriceOf(p) ?? 0])) },
                },
                  startsAt,
                  endsAt
                )
              }
            >
              {saving ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "เพิ่มเข้ารายการ"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
