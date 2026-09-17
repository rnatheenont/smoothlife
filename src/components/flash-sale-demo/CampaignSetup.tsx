"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Button, Card } from "@heroui/react";
import { Check, Search } from "lucide-react";
import { formatTHB } from "@/lib/format";
import { MAX_GROUP_PRODUCTS, type CampaignConfig, type DemoProduct } from "./campaign";
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
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="inline-flex rounded-full bg-surface-muted p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`min-h-9 rounded-full px-4 text-sm font-semibold transition ${
            value === o.value ? "bg-white text-brand-ink shadow-card" : "text-slate-600 hover:text-brand-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const fieldClass =
  "min-h-11 w-full rounded-xl2 border border-surface-line bg-white px-3 text-sm text-brand-ink focus:border-brand-800 focus:outline-none";

/**
 * Admin side of the demo: pick what the flash sale sells — one product, or a
 * whole group (category, brand or Shopify collection) — and the per-sale
 * settings, then restart the simulation with it. In the real system this is
 * the form that inserts `flash_sale` rows (plan §0), one per product.
 */
export default function CampaignSetup({
  config,
  catalogue,
  groups,
  now,
  onCreate,
  saving = false,
}: {
  config: CampaignConfig;
  catalogue: CatalogueItem[];
  groups: ProductGroup[];
  /** Demo clock (epoch ms) — new campaigns default to starting 10 minutes from it. */
  now: number;
  onCreate: (config: CampaignConfig, startsAt: number, endsAt?: number) => void | Promise<unknown>;
  /** Saving to the database; the button waits for it. */
  saving?: boolean;
}) {
  const [mode, setMode] = useState<CampaignConfig["mode"]>(config.mode);
  const [query, setQuery] = useState("");
  const [productSlug, setProductSlug] = useState(config.products[0]?.slug ?? catalogue[0]?.slug);
  const [kind, setKind] = useState<ProductGroup["kind"]>("brand");
  const kindGroups = useMemo(() => groups.filter((g) => g.kind === kind), [groups, kind]);
  const [groupId, setGroupId] = useState<string>(() => groups.find((g) => g.kind === "brand")?.id ?? groups[0]?.id ?? "");
  const [stock, setStock] = useState(config.stockPerProduct);
  const [windowMinutes, setWindowMinutes] = useState(config.windowMinutes);
  const [maxRequeue, setMaxRequeue] = useState(config.maxRequeue);
  const [startInput, setStartInput] = useState(() => toLocalInput(Math.ceil((now + 10 * 60_000) / 60_000) * 60_000));
  const [hasEnd, setHasEnd] = useState(true);
  const [endInput, setEndInput] = useState(() => toLocalInput(Math.ceil((now + 130 * 60_000) / 60_000) * 60_000));
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
  const title = mode === "single" ? `Flash Sale · ${selectedProduct?.name ?? ""}` : `Flash Sale ${KIND_LABEL[kind]} ${group?.label ?? ""}`;
  const canCreate = products.length > 0 && stock >= 1 && !timeError;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-brand-ink">สร้างแคมเปญใหม่</h3>
          <p className="text-sm text-slate-500">เลือกสินค้า ตั้งวันเวลา แล้วเพิ่มเข้ารายการ ระบบจะเปิดและปิดการขายให้เองตามเวลา</p>
        </div>
        <Segmented<CampaignConfig["mode"]>
          label="ประเภทแคมเปญ"
          value={mode}
          onChange={setMode}
          options={[
            { value: "single", label: "สินค้าชิ้นเดียว" },
            { value: "group", label: "กลุ่มสินค้า" },
          ]}
        />
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
            <select id="fs-group" value={group?.id ?? ""} onChange={(e) => setGroupId(e.target.value)} className={fieldClass}>
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <div>
              <label htmlFor="fs-start" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                เริ่มขาย
              </label>
              <input
                id="fs-start"
                type="datetime-local"
                value={startInput}
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
          <div>
            <label htmlFor="fs-stock" className="mb-1.5 block text-sm font-semibold text-brand-ink">
              สต็อกต่อสินค้า (ชิ้น)
            </label>
            <input
              id="fs-stock"
              type="number"
              inputMode="numeric"
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
              <select id="fs-window" value={windowMinutes} onChange={(e) => setWindowMinutes(Number(e.target.value))} className={fieldClass}>
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
              <select id="fs-requeue" value={maxRequeue} onChange={(e) => setMaxRequeue(Number(e.target.value))} className={fieldClass}>
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
          <Button
            size="lg"
            fullWidth
            isDisabled={!canCreate || saving}
            isPending={saving}
            onPress={() =>
              onCreate(
                {
                  mode,
                  title,
                  products: products.map(({ slug, name, brand, image, price, compareAtPrice }) => ({ slug, name, brand, image, price, compareAtPrice })),
                  stockPerProduct: stock,
                  windowMinutes,
                  maxRequeue,
                  group: mode === "group" && group ? { kind, key: group.id } : undefined,
                },
                startsAt,
                endsAt
              )
            }
          >
            {saving ? "กำลังบันทึก…" : "เพิ่มเข้ารายการ"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
