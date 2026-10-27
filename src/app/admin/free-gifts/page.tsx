"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Gift,
  Check,
  Trash2,
  Power,
  Plus,
  X,
  ShoppingBag,
  Layers,
  TrendingUp,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { FreeGiftPromo, FreeGiftTier, giftsOf } from "@/data/free-gifts";
import { getProductBySlug, products } from "@/data/products";
import { Badge } from "@/components/ui";
import ProductPicker from "@/components/admin/ProductPicker";
import GiftPicker, {
  giftName,
  useGiftShelf,
  type GiftChoice,
} from "@/components/admin/GiftPicker";
import { useAdminAction } from "@/components/admin/header-action";
import { PageHeader, adminTable } from "@/components/admin/layout-kit";
import GiftStockPanel from "./GiftStockPanel";
import { Button } from "@heroui/react";
import AdminField from "@/components/admin/AdminField";
import { CAMPAIGN_PRESETS } from "@/lib/campaign-types";
import GiftWidgetStyleEditor from "@/components/admin/GiftWidgetStyleEditor";

type AdminPromo = FreeGiftPromo & { id: string };

/** One chosen gift. Every condition holds a list of these: a tier that hands
 *  over a toothpaste and a toothbrush is one tier, not two. */
type GiftFormRow = {
  variantId: string;
  title: string;
  image: string | null;
  qty: string;
};

type TierFormRow = {
  minSubtotal: string;
  giftProductSlug: string;
  gifts: GiftFormRow[];
  /** A milestone prices its own reward, the way the app's per-milestone
   *  "Discount type" dropdown does. Empty means the campaign decides. */
  discountType: "" | "free" | "percentage" | "fixed";
  discountValue: string;
};

type FormState = {
  slug: string;
  titleTh: string;
  titleEn: string;
  kind: "bxgy" | "spend" | "tiered";
  buyProductSlugs: string[];
  buyQty: string;
  minSubtotal: string;
  giftProductSlug: string;
  /** The real Shopify gifts, chosen from the shop's free-gift shelf. */
  gifts: GiftFormRow[];
  tiers: TierFormRow[];
  starts: string;
  expires: string;
  /** The app's "Tiered reward type": money or items. */
  triggerType: "cart-value" | "quantity";
  /** Its "Exclude product" and "Include collection" sub-conditions. */
  excludedProductSlugs: string[];
  scopeBrands: string[];
  scopeCategories: string[];
  /** Its gift limitation, and its "Free gift selection method". */
  maxGifts: string;
  giftChoice: "auto" | "customer";
  /** Its per-campaign "Discount type". */
  discountType: "free" | "percentage" | "fixed";
  discountValue: string;
  /** The app's Order Goal and Volume Discount: the same ladder with money off
   *  the order instead of a product at the top. */
  rewardType: "gift" | "order_discount";
  /** The app's customer-segment targeting, in the segments this shop has. */
  customerTiers: string[];
  firstOrderOnly: boolean;
  minQty: string;
  /** This campaign's own widget look. Empty object = follow the shop-wide
   *  default, which is what every campaign does until somebody changes one. */
  widgetStyle: Record<string, unknown>;
};

const EMPTY_TIER_ROW: TierFormRow = {
  minSubtotal: "",
  giftProductSlug: "",
  gifts: [],
  discountType: "",
  discountValue: "",
};

const EMPTY_FORM: FormState = {
  slug: "",
  titleTh: "",
  titleEn: "",
  kind: "spend",
  buyProductSlugs: [],
  buyQty: "1",
  minSubtotal: "",
  giftProductSlug: "",
  gifts: [],
  tiers: [{ ...EMPTY_TIER_ROW }],
  starts: "",
  expires: "",
  triggerType: "cart-value",
  excludedProductSlugs: [],
  scopeBrands: [],
  scopeCategories: [],
  maxGifts: "",
  giftChoice: "auto",
  discountType: "free",
  discountValue: "",
  rewardType: "gift",
  customerTiers: [],
  firstOrderOnly: false,
  minQty: "",
  widgetStyle: {},
};

/** What the API is told about one chosen gift. The name and picture are for
 *  the operator's eyes only — the server looks both up from the shelf. */
/** What a promo in the list hands over, in one line.
 *
 *  The table read getProductBySlug(p.giftProductSlug) — the catalogue — and
 *  every promo written this year keeps its gifts as Shopify variants instead,
 *  so the thumbnail was an empty square and the line read "รับฟรี  x1" with
 *  the name missing between them. */
function promoGiftLine(p: AdminPromo, nameFor: (variantId: string) => string | undefined): string {
  const sources = p.kind === "tiered" ? (p.tiers ?? []) : [p];
  const names = sources
    .flatMap((src) => giftsOf(src))
    .map((g) => giftName(g.title || (g.variantId ? nameFor(g.variantId) : "") || ""))
    .filter(Boolean);
  const unique = [...new Set(names)];
  if (unique.length === 0) return "";
  return unique.slice(0, 3).join(" + ") + (unique.length > 3 ? ` +${unique.length - 3}` : "");
}

/** "ยาสีฟัน x2 + แปรงสีฟัน" — what the operator is about to promise, read
 *  back to them before they save it.
 *
 *  The names come from the shelf, because a promo loaded for editing arrives
 *  from the admin API as variant ids: without the resolver this read
 *  "฿699 → ของแถม", which is the one thing the preview exists not to say. */
function describeGifts(gifts: GiftFormRow[], nameFor?: (variantId: string) => string | undefined): string {
  if (gifts.length === 0) return "—";
  return gifts
    .map((g) => {
      const name = giftName(g.title || nameFor?.(g.variantId) || "") || "ของแถม";
      return Number(g.qty) > 1 ? `${name} x${g.qty}` : name;
    })
    .join(" + ");
}

function toGiftInput(g: GiftFormRow) {
  return { variantId: g.variantId, qty: Number(g.qty) || 1 };
}

/** An existing promo's gifts, in the shape the form edits.
 *
 *  giftsOf is the one place that knows whether a promo keeps its gifts in a
 *  list or in the three older single-gift columns, so reading it here means a
 *  promo written either way opens in this form without being rewritten. */
function giftRowsOf(source: Parameters<typeof giftsOf>[0]): GiftFormRow[] {
  return giftsOf(source).map((item) => ({
    variantId: item.variantId ?? "",
    title: item.title ?? "",
    image: item.image ?? null,
    qty: String(item.qty ?? 1),
  }));
}

/** The gifts one condition hands over, with a picker to add more.
 *
 *  Every condition used to hold exactly one gift and one quantity, so a
 *  campaign giving away a toothpaste AND a toothbrush at ฿1,599 could not be
 *  written down at all — the operator had to make two promos and hope they
 *  fired together. The schema has held a list for a while; this is the form
 *  catching up. */
/**
 * The app's "Show sub-conditions": the two rules that decide which lines in a
 * basket count toward the campaign at all.
 *
 * Folded away by default, as it is there, because most campaigns want the
 * whole catalogue and an open panel of empty pickers reads as work to do.
 */
/** The app's "Discount type" dropdown and the number beside it. A reward is
 *  free by default — every campaign this shop has run — and the other two
 *  entries sell it at a discount instead of giving it away. */
function DiscountTypeField({
  type,
  value,
  onChange,
  label,
  allowInherit,
}: {
  type: "" | "free" | "percentage" | "fixed";
  value: string;
  onChange: (type: "" | "free" | "percentage" | "fixed", value: string) => void;
  label: string;
  allowInherit?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-brand-ink">{label}</p>
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => onChange(e.target.value as "" | "free" | "percentage" | "fixed", value)}
          className="min-w-0 flex-1 rounded-lg border border-surface-line bg-white px-2 py-2 text-xs text-brand-ink"
        >
          {allowInherit && <option value="">ตามที่ตั้งไว้ของแคมเปญ</option>}
          <option value="free">ฟรี</option>
          <option value="percentage">ลดเป็น %</option>
          <option value="fixed">ราคาตายตัว</option>
        </select>
        {(type === "percentage" || type === "fixed") && (
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={type === "percentage" ? 100 : undefined}
            value={value}
            onChange={(e) => onChange(type, e.target.value)}
            placeholder={type === "percentage" ? "เช่น 50" : "เช่น 99"}
            aria-label={type === "percentage" ? "ส่วนลดเป็นเปอร์เซ็นต์" : "ราคาที่ลูกค้าจ่าย"}
            className="w-24 rounded-lg border border-surface-line bg-white px-2 py-2 text-xs text-brand-ink"
          />
        )}
      </div>
    </div>
  );
}

function SubConditions({
  open,
  onToggle,
  form,
  setForm,
}: {
  open: boolean;
  onToggle: () => void;
  form: FormState;
  setForm: (f: FormState) => void;
}) {
  const brands: string[] = [...new Set(products.map((p) => p.brand))].filter(Boolean).sort();
  const categories: string[] = [...new Set(products.map((p) => String(p.category)))]
    .filter(Boolean)
    .sort();

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-[11px] font-semibold text-brand-800"
      >
        <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        {open ? "ซ่อนเงื่อนไขย่อย" : "แสดงเงื่อนไขย่อย"}
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-lg border border-surface-line p-3">
          <div>
            <p className="text-[11px] font-semibold text-brand-ink">ยกเว้นสินค้า</p>
            <p className="mb-1.5 text-[10px] text-slate-400">
              สินค้าที่เลือกไว้จะไม่ถูกนับเข้ายอด — ใช้กันไม่ให้ของแถมจ่ายค่าตัวเอง
            </p>
            {form.excludedProductSlugs.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {form.excludedProductSlugs.map((slug) => (
                  <span
                    key={slug}
                    className="flex items-center gap-1 rounded-full bg-surface-soft px-2 py-0.5 text-[10px] text-brand-ink"
                  >
                    {getProductBySlug(slug)?.name ?? slug}
                    <button
                      type="button"
                      aria-label={`เอา ${slug} ออกจากรายการยกเว้น`}
                      onClick={() =>
                        setForm({
                          ...form,
                          excludedProductSlugs: form.excludedProductSlugs.filter((x) => x !== slug),
                        })
                      }
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <ProductPicker
              onSelect={(slug) =>
                setForm({
                  ...form,
                  excludedProductSlugs: form.excludedProductSlugs.includes(slug)
                    ? form.excludedProductSlugs
                    : [...form.excludedProductSlugs, slug],
                })
              }
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold text-brand-ink">เฉพาะลูกค้ากลุ่มนี้</p>
            <p className="mb-1.5 text-[10px] text-slate-400">
              ไม่เลือกเลย = ทุกคน (แอปบน Shopify ใช้ customer segment — ของเราใช้ระดับสมาชิกที่ร้านมีจริง)
            </p>
            <div className="flex flex-wrap items-center gap-1">
              {(["Bronze", "Silver", "Gold"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setForm({ ...form, customerTiers: toggleIn(form.customerTiers, tier) })}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                    form.customerTiers.includes(tier)
                      ? "bg-brand-gradient text-white"
                      : "bg-surface-soft text-slate-500"
                  }`}
                >
                  {tier}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setForm({ ...form, firstOrderOnly: !form.firstOrderOnly })}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                  form.firstOrderOnly ? "bg-brand-gradient text-white" : "bg-surface-soft text-slate-500"
                }`}
              >
                เฉพาะออเดอร์แรก
              </button>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-brand-ink">และต้องซื้อครบกี่ชิ้น</p>
            <p className="mb-1.5 text-[10px] text-slate-400">
              เงื่อนไขที่สอง ต้องเข้าพร้อมกับเงื่อนไขหลัก — ไม่กรอก = ไม่บังคับจำนวน
            </p>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={form.minQty}
              onChange={(e) => setForm({ ...form, minQty: e.target.value })}
              placeholder="เช่น 3"
              aria-label="จำนวนชิ้นขั้นต่ำ"
              className="w-28 rounded-lg border border-surface-line bg-white px-2 py-2 text-xs text-brand-ink"
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold text-brand-ink">นับเฉพาะแบรนด์ / หมวด</p>
            <p className="mb-1.5 text-[10px] text-slate-400">
              ไม่เลือกเลย = นับทั้งร้าน (แอปบน Shopify ใช้ collection — ของเราใช้แบรนด์กับหมวดที่บรรทัดตะกร้ามีจริง)
            </p>
            <div className="flex flex-wrap gap-1">
              {brands.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => setForm({ ...form, scopeBrands: toggleIn(form.scopeBrands, brand) })}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                    form.scopeBrands.includes(brand)
                      ? "bg-brand-gradient text-white"
                      : "bg-surface-soft text-slate-500"
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() =>
                    setForm({ ...form, scopeCategories: toggleIn(form.scopeCategories, category) })
                  }
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                    form.scopeCategories.includes(category)
                      ? "bg-brand-gradient text-white"
                      : "bg-surface-soft text-slate-500"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GiftListField({
  gifts,
  onChange,
  label,
}: {
  gifts: GiftFormRow[];
  onChange: (next: GiftFormRow[]) => void;
  label: string;
}) {
  const [picking, setPicking] = useState(false);
  // The admin API hands back variant ids and nothing else, so a promo that
  // already has gifts would show a row of 40-character gids. The shelf the
  // picker reads is the only place their names live on this side.
  const { gifts: shelf } = useGiftShelf();
  const nameOf = (g: GiftFormRow) =>
    giftName(g.title || shelf?.find((s) => s.variantId === g.variantId)?.title || "") || g.variantId;
  const imageOf = (g: GiftFormRow) =>
    g.image ?? shelf?.find((s) => s.variantId === g.variantId)?.image ?? null;

  const replace = (i: number, patch: Partial<GiftFormRow>) =>
    onChange(gifts.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-brand-ink">
        {label}
        {gifts.length > 1 && (
          <span className="ml-1 font-normal text-slate-400">({gifts.length} ชิ้น)</span>
        )}
      </p>

      {gifts.map((g, i) => (
        <div key={`${g.variantId}-${i}`} className="flex items-center gap-2 rounded-lg bg-surface-soft p-1.5">
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white">
            {imageOf(g) && <Image src={imageOf(g)!} alt="" fill sizes="36px" className="object-contain" />}
          </span>
          {/* break-words, because the fallback here is a raw variant id —
              one unbroken 40-character token that pushed the quantity box and
              the remove button off the side of the card on a phone. */}
          <span className="line-clamp-2 min-w-0 flex-1 break-words text-xs leading-tight text-brand-ink">
            {nameOf(g)}
          </span>
          {/* Quantity belongs to the gift, not to the condition: two of one
              thing and one of another is an ordinary way to run a campaign. */}
          <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
            x
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={g.qty}
              onChange={(e) => replace(i, { qty: e.target.value })}
              aria-label={`จำนวนของ ${nameOf(g)}`}
              className="w-12 rounded-md border border-surface-line bg-white px-1.5 py-1 text-center text-xs text-brand-ink"
            />
          </label>
          <button
            type="button"
            aria-label={`เอา ${nameOf(g)} ออก`}
            onClick={() => onChange(gifts.filter((_, idx) => idx !== i))}
          >
            <X size={13} className="text-slate-400" />
          </button>
        </div>
      ))}

      {/* The picker is a 29-row searchable list, and a three-level promo draws
          one per level. Open, they turned the form into a page of lists with
          the actual settings lost between them — so it opens only for the
          level being edited, and closes again once something is chosen. */}
      {picking || gifts.length === 0 ? (
        <div className="rounded-lg border border-surface-line p-2">
          <GiftPicker
            onSelect={(choice: GiftChoice) => {
              setPicking(false);
              // The same gift twice is one gift with a bigger number — picking
              // it again is what somebody does when they mean two.
              const at = gifts.findIndex((g) => g.variantId === choice.variantId);
              if (at >= 0) {
                replace(at, { qty: String((Number(gifts[at].qty) || 1) + 1) });
                return;
              }
              onChange([
                ...gifts,
                { variantId: choice.variantId, title: choice.title, image: choice.image, qty: "1" },
              ]);
            }}
          />
          {gifts.length === 0 ? (
            <p className="mt-1 text-[11px] text-amber-700">ยังไม่ได้เลือกของแถม — เลือกอย่างน้อย 1 ชิ้น</p>
          ) : (
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="mt-1 text-[11px] text-slate-400 hover:text-slate-600"
            >
              ยกเลิก
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex items-center gap-1 text-xs font-semibold text-brand-800"
        >
          <Plus size={13} /> เพิ่มของแถมอีกชิ้น
        </button>
      )}
    </div>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Plain-language sentence describing exactly what the customer will
// experience — shown both on the list and as a live preview in the form, so
// a non-technical operator never has to mentally translate the raw fields.
function describeCondition(p: {
  kind: "bxgy" | "spend" | "tiered";
  minSubtotal?: number | string;
  buyProductSlugs?: string[];
  buyQty?: number | string;
  tiers?: FreeGiftTier[] | TierFormRow[];
}) {
  if (p.kind === "spend") {
    const amount = p.minSubtotal || "___";
    return `ลูกค้าซื้อสินค้าอะไรก็ได้ครบ ฿${Number(amount).toLocaleString()}`;
  }
  if (p.kind === "tiered") {
    const tiers = p.tiers ?? [];
    if (tiers.length === 0) return "ยังไม่ได้ตั้งระดับ";
    return tiers
      .map(
        (t, i) =>
          `ครบ ฿${Number(t.minSubtotal || 0).toLocaleString()} → ระดับ ${i + 1}`,
      )
      .join(", ");
  }
  const count = (p.buyProductSlugs ?? []).length;
  const qty = p.buyQty || "___";
  return `ลูกค้าซื้อสินค้าที่กำหนด (${count} รายการ) รวมครบ ${qty} ชิ้น`;
}

export default function AdminFreeGiftsPage() {
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Two steps, the way the app on Shopify splits this: what the campaign is,
  // then how it shows up. Operators move between the two consoles all day and
  // a form shaped differently is a form they have to re-learn each time.
  // 0 is the app's "Choose campaign type" screen. Editing an existing
  // campaign skips it — the type was a way of choosing, not a property of
  // the row, and re-asking would imply the answer could be changed.
  const [step, setStep] = useState<0 | 1 | 2>(1);
  const [showSubConditions, setShowSubConditions] = useState(false);
  /** The card the campaign was started from. A label, not a stored property:
   *  the header saying "สร้าง: ยิ่งซื้อยิ่งลด (ตามจำนวน)" is the difference
   *  between knowing which form you are in and guessing from the toggles. */
  const [presetTitle, setPresetTitle] = useState<string | null>(null);
  // The shelf is already loaded for the pickers; the preview borrows it to
  // turn the variant ids an edited promo arrives with into names.
  const { gifts: shelf } = useGiftShelf();
  const shelfNameFor = (variantId: string) => shelf?.find((g) => g.variantId === variantId)?.title;

  // Live first. The one question this page is opened with is "what is running
  // right now", and the answer was a badge you had to read on every row of a
  // list ordered by when each promo happened to be created.
  const sortedPromos = [...promos].sort((a, b) => Number(b.active) - Number(a.active));
  const liveCount = promos.filter((p) => p.active).length;

  async function loadList() {
    const res = await fetch("/api/admin/free-gifts");
    if (res.status === 401) return;
    const data = await res.json();
    setPromos(data.promos ?? []);
  }

  useEffect(() => {
    loadList();
  }, []);

  useAdminAction({
    label: "สร้างโปรโมชั่นใหม่",
    icon: <Plus size={15} aria-hidden />,
    onClick: () => openCreateForm(),
  });

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowAdvanced(false);
    setStep(0);
    setShowSubConditions(false);
    setPresetTitle(null);
    setShowForm(true);
  }

  function startFromPreset(preset: (typeof CAMPAIGN_PRESETS)[number]) {
    const { tiers, ...rest } = preset.preset;
    setForm({
      ...EMPTY_FORM,
      ...rest,
      // The tiers come as bare numbers; the form rows carry gift lists too.
      tiers: tiers
        ? tiers.map((t) => ({ ...EMPTY_TIER_ROW, ...t }))
        : [{ ...EMPTY_TIER_ROW }],
    });
    setPresetTitle(preset.title);
    setShowSubConditions(Boolean(preset.openSubConditions));
    setStep(1);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const body = {
        // slugify() drops any character outside a-z0-9 — a Thai-only title
        // (titleEn blank) collapses to an empty string, so fall back to a
        // generated id rather than submitting a slug that fails validation.
        slug:
          form.slug ||
          slugify(form.titleEn || form.titleTh) ||
          `promo-${Date.now().toString(36)}`,
        titleTh: form.titleTh,
        titleEn: form.titleEn || form.titleTh,
        kind: form.kind,
        buyProductSlugs:
          form.kind === "bxgy" ? form.buyProductSlugs : undefined,
        buyQty: form.kind === "bxgy" ? Number(form.buyQty) : undefined,
        minSubtotal:
          form.kind === "spend" ? Number(form.minSubtotal) : undefined,
        giftProductSlug:
          form.kind === "tiered" ? undefined : form.giftProductSlug,
        gifts: form.kind === "tiered" ? undefined : form.gifts.map(toGiftInput),
        tiers:
          form.kind === "tiered"
            ? form.tiers.map((t) => ({
                minSubtotal: Number(t.minSubtotal),
                gifts: t.gifts.map(toGiftInput),
                discountType: t.discountType || undefined,
                discountValue: t.discountValue ? Number(t.discountValue) : undefined,
              }))
            : undefined,
        starts: form.starts || undefined,
        expires: form.expires || undefined,
        triggerType: form.triggerType,
        excludedProductSlugs: form.excludedProductSlugs,
        scopeBrands: form.scopeBrands,
        scopeCategories: form.scopeCategories,
        maxGifts: form.maxGifts ? Number(form.maxGifts) : null,
        giftChoice: form.giftChoice,
        discountType: form.discountType,
        discountValue: form.discountValue ? Number(form.discountValue) : 0,
        rewardType: form.rewardType,
        customerTiers: form.customerTiers,
        firstOrderOnly: form.firstOrderOnly,
        minQty: form.minQty ? Number(form.minQty) : null,
        widgetStyle: Object.keys(form.widgetStyle).length > 0 ? form.widgetStyle : null,
      };
      const url = editingId
        ? `/api/admin/free-gifts/${editingId}`
        : "/api/admin/free-gifts";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        setFormError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setShowForm(false);
      loadList();
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(p: AdminPromo) {
    setEditingId(p.id);
    setForm({
      slug: p.slug,
      titleTh: p.titleTh,
      titleEn: p.titleEn,
      kind: p.kind,
      buyProductSlugs: p.buyProductSlugs ?? [],
      buyQty: String(p.buyQty ?? 1),
      minSubtotal: String(p.minSubtotal ?? ""),
      giftProductSlug: p.giftProductSlug,
      gifts: giftRowsOf(p),
      tiers:
        p.tiers && p.tiers.length > 0
          ? p.tiers.map((t) => ({
              minSubtotal: String(t.minSubtotal),
              giftProductSlug: t.giftProductSlug,
              gifts: giftRowsOf(t),
              discountType: t.discountType ?? ("" as const),
              discountValue: t.discountValue != null ? String(t.discountValue) : "",
            }))
          : [{ ...EMPTY_TIER_ROW }],
      starts: p.starts ? p.starts.slice(0, 10) : "",
      expires: p.expires ?? "",
      triggerType: p.triggerType === "quantity" ? "quantity" : "cart-value",
      excludedProductSlugs: p.excludedProductSlugs ?? [],
      scopeBrands: p.scopeBrands ?? [],
      scopeCategories: p.scopeCategories ?? [],
      maxGifts: p.maxGifts != null ? String(p.maxGifts) : "",
      giftChoice: p.giftChoice === "customer" ? "customer" : "auto",
      discountType: p.discountType ?? "free",
      discountValue: p.discountValue ? String(p.discountValue) : "",
      rewardType: p.rewardType === "order_discount" ? "order_discount" : "gift",
      customerTiers: p.customerTiers ?? [],
      firstOrderOnly: p.firstOrderOnly === true,
      minQty: p.minQty != null ? String(p.minQty) : "",
      widgetStyle: p.widgetStyle ?? {},
    });
    setFormError("");
    setShowAdvanced(false);
    setStep(1);
    setShowSubConditions(false);
    setPresetTitle(null);
    setShowForm(true);
  }

  async function activate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/free-gifts/${id}/activate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "เปิดใช้งานไม่สำเร็จ");
        return;
      }
      loadList();
    } finally {
      setBusyId(null);
    }
  }

  // Separate from activate() on purpose: this one reaches the shop's live
  // discount list and applies to www, the Shopify theme. Turning a promo on
  // here no longer does it, because this site hands out the gift itself.
  async function createShopifyDiscount(id: string) {
    if (
      !confirm(
        "สร้างส่วนลดอัตโนมัติบนร้าน Shopify จริง\n\n" +
          "มีผลกับ www.smoothlife.com (ธีม Shopify) ทันที — ส่วน app.smoothlife.com " +
          "แจกของแถมเองอยู่แล้วโดยไม่ต้องใช้ส่วนลดนี้",
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/free-gifts/${id}/shopify-discount`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "สร้างส่วนลดไม่สำเร็จ");
        return;
      }
      loadList();
    } finally {
      setBusyId(null);
    }
  }

  async function deactivate(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/admin/free-gifts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      loadList();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("ลบโปรโมชั่นนี้? กู้คืนไม่ได้")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/free-gifts/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) alert(data.error || "ลบไม่สำเร็จ");
      loadList();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        className="mb-4"
        icon={<Gift size={20} className="text-brand-emerald" />}
        title="ของแถม & โปรโมชั่น"
        subtitle="ตั้งโปร “ซื้อครบแถมฟรี” — ระบบจะเพิ่มของแถมในตะกร้าลูกค้าอัตโนมัติ และผูกกับส่วนลดจริงใน Shopify ให้ทันที"
      />

      {promos.length === 0 ? (
        /* The dashed block is the whole invitation when there is nothing
           here yet. Once there are promos it would be a full row of empty
           space above them, so it becomes the header's button instead. */
        <button
          onClick={openCreateForm}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl2 border-2 border-dashed border-slate-200 py-12 text-sm font-semibold text-slate-500 transition-colors hover:border-brand-teal hover:text-brand-800"
        >
          <Sparkles size={26} className="text-slate-300" />
          ยังไม่มีโปรโมชั่น — กดเพื่อสร้างโปรแรก
        </button>
      ) : (
        /* Two to a row: each promo is a small card, and one per row left a
           wide screen mostly empty while the tenth promo sat below the fold. */
        <>
          {/* The answer to "what is running right now", before the list that
              has to be read to work it out. */}
          <p className="mb-2 text-xs text-slate-500">
            {liveCount > 0 ? (
              <>
                <span className="font-bold text-brand-800">กำลังใช้งานจริง {liveCount} โปร</span>
                {promos.length > liveCount && ` · ร่างอีก ${promos.length - liveCount}`}
              </>
            ) : (
              <span className="font-semibold text-amber-700">
                ยังไม่มีโปรที่เปิดใช้งาน — ลูกค้าไม่เห็นของแถมบนหน้าเว็บตอนนี้
              </span>
            )}
          </p>

          {/* A table, because the questions are comparisons: which of these
              is live, which are still drafts, which are actually wired to a
              Shopify discount. As cards each of those answers sat wherever
              the title above it happened to end. */}
          <div className="hidden overflow-hidden rounded-xl2 bg-white shadow-card md:block">
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th>โปรโมชั่น</th>
                  <th className="w-36">แบบ</th>
                  <th className="w-52">สถานะ</th>
                  <th className="w-72 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {sortedPromos.map((p) => {
                  const giftLine = promoGiftLine(p, shelfNameFor);
                  const lead = giftsOf(p.kind === "tiered" ? (p.tiers?.[0] ?? p) : p)[0];
                  const giftImage =
                    lead?.image ??
                    (lead?.variantId ? shelf?.find((g) => g.variantId === lead.variantId)?.image : null) ??
                    null;
                  const KindIcon =
                    p.kind === "spend"
                      ? ShoppingBag
                      : p.kind === "bxgy"
                        ? Layers
                        : TrendingUp;
                  const kindLabel =
                    p.kind === "spend"
                      ? "ซื้อครบยอด"
                      : p.kind === "bxgy"
                        ? "ซื้อครบจำนวน"
                        : "ขั้นบันได";
                  const tierDiscountsLinked =
                    p.kind === "tiered" &&
                    (p.tiers ?? []).every((t) => t.shopifyDiscountId);
                  return (
                    <tr
                      key={p.id}
                      className={`${adminTable.row} ${p.active ? "bg-brand-gradient-soft/60" : ""}`}
                    >
                      <td className={adminTable.cell}>
                        <span className="flex items-start gap-3">
                          <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl2 bg-surface-soft">
                            {giftImage ? (
                              <Image
                                src={giftImage}
                                alt=""
                                fill
                                sizes="44px"
                                className="object-contain"
                              />
                            ) : (
                              <Gift size={18} className="text-slate-300" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-brand-ink">
                              {p.titleTh}
                            </span>
                            <span className="mt-0.5 block max-w-[60ch] text-[12px] text-slate-500">
                              {describeCondition(p)}
                              {giftLine && (
                                <>
                                  {" → "}
                                  <span className="font-semibold text-brand-ink">รับฟรี {giftLine}</span>
                                </>
                              )}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className={adminTable.cell}>
                        <span className="flex items-center gap-1 whitespace-nowrap text-[12px] text-slate-500">
                          <KindIcon size={12} /> {kindLabel}
                        </span>
                      </td>
                      <td className={adminTable.cell}>
                        <Badge tone={p.active ? "brand" : "neutral"}>
                          {p.active ? "กำลังใช้งานจริง" : "ร่าง — ยังไม่เปิด"}
                        </Badge>
                        {(p.shopifyDiscountId || tierDiscountsLinked) && (
                          <span className="mt-1 flex items-center gap-1 text-[10px] text-brand-800">
                            <Check size={11} /> เชื่อมส่วนลดใน Shopify แล้ว
                          </span>
                        )}
                      </td>
                      <td className={adminTable.cell}>
                        {/* One decision, then the rest.
                            Four pills of equal weight wrapped onto two lines
                            in a 288px column, so "เปิดใช้งานจริง" — the only
                            one that changes what customers see — looked like
                            an option among four. */}
                        <span className="flex flex-col items-end gap-1.5">
                          {p.active ? (
                            <button
                              onClick={() => deactivate(p.id)}
                              disabled={busyId === p.id}
                              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 disabled:opacity-50"
                            >
                              <Power size={12} /> ปิดใช้งาน
                            </button>
                          ) : (
                            <button
                              onClick={() => activate(p.id)}
                              disabled={busyId === p.id}
                              className="flex items-center gap-1 rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                            >
                              <Check size={12} />{" "}
                              {busyId === p.id ? "กำลังเปิด…" : "เปิดใช้งานจริง"}
                            </button>
                          )}
                          <span className="flex items-center gap-2 text-[11px] text-slate-400">
                            <button
                              onClick={() => startEdit(p)}
                              className="font-semibold hover:text-brand-800"
                            >
                              แก้ไข
                            </button>
                            {!p.shopifyDiscountId && !tierDiscountsLinked && (
                              <>
                                <span aria-hidden>·</span>
                                <button
                                  onClick={() => createShopifyDiscount(p.id)}
                                  disabled={busyId === p.id}
                                  className="whitespace-nowrap font-semibold text-amber-700 hover:underline disabled:opacity-50"
                                >
                                  + ส่วนลด Shopify
                                </button>
                              </>
                            )}
                            <span aria-hidden>·</span>
                            <button
                              onClick={() => remove(p.id)}
                              disabled={p.active || busyId === p.id}
                              title={p.active ? "ปิดใช้งานก่อนถึงจะลบได้" : "ลบโปรโมชั่นนี้"}
                              className="font-semibold text-rose-500 hover:underline disabled:opacity-30"
                            >
                              ลบ
                            </button>
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid items-start gap-3 md:hidden">
            {sortedPromos.map((p) => {
              const giftLine = promoGiftLine(p, shelfNameFor);
              const cardLead = giftsOf(p.kind === "tiered" ? (p.tiers?.[0] ?? p) : p)[0];
              const cardGiftImage =
                cardLead?.image ??
                (cardLead?.variantId ? shelf?.find((g) => g.variantId === cardLead.variantId)?.image : null) ??
                null;
              const KindIcon =
                p.kind === "spend"
                  ? ShoppingBag
                  : p.kind === "bxgy"
                    ? Layers
                    : TrendingUp;
              const kindLabel =
                p.kind === "spend"
                  ? "ซื้อครบยอด"
                  : p.kind === "bxgy"
                    ? "ซื้อครบจำนวน"
                    : "ขั้นบันได";
              const tierDiscountsLinked =
                p.kind === "tiered" &&
                (p.tiers ?? []).every((t) => t.shopifyDiscountId);
              return (
                <div
                  key={p.id}
                  className="rounded-xl2 border border-slate-100 bg-white p-4 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl2 bg-surface-soft">
                      {cardGiftImage ? (
                        <Image src={cardGiftImage} alt="" fill sizes="56px" className="object-contain" />
                      ) : (
                        <Gift size={20} className="text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${
                            p.active
                              ? "bg-brand-gradient-soft text-brand-800"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${p.active ? "bg-brand-emerald" : "bg-slate-300"}`}
                          />
                          {p.active
                            ? "กำลังใช้งานจริง"
                            : "ร่าง — ยังไม่เปิดใช้งาน"}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <KindIcon size={11} /> {kindLabel}
                        </span>
                      </div>
                      <p className="font-bold text-brand-ink mt-1">
                        {p.titleTh}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {describeCondition(p)}
                        {giftLine && (
                          <>
                            {" → "}
                            <span className="font-semibold text-brand-ink">รับฟรี {giftLine}</span>
                          </>
                        )}
                      </p>
                      {(p.shopifyDiscountId || tierDiscountsLinked) && (
                        <p className="flex items-center gap-1 text-[10px] text-brand-800 mt-1">
                          <Check size={11} /> เชื่อมกับส่วนลดจริงใน Shopify แล้ว
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {!p.active && (
                      <button
                        onClick={() => activate(p.id)}
                        disabled={busyId === p.id}
                        className="flex items-center gap-1 rounded-full bg-brand-gradient text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
                      >
                        <Check size={12} />{" "}
                        {busyId === p.id
                          ? "กำลังเปิดใช้งาน…"
                          : "เปิดใช้งานจริง"}
                      </button>
                    )}
                    {p.active && (
                      <button
                        onClick={() => deactivate(p.id)}
                        disabled={busyId === p.id}
                        className="flex items-center gap-1 rounded-full border border-slate-200 text-slate-500 text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
                      >
                        <Power size={12} /> ปิดใช้งาน
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(p)}
                      className="rounded-full border border-slate-200 text-slate-500 text-xs font-semibold px-3 py-1.5"
                    >
                      แก้ไข
                    </button>
                    {/* The hint sits on a wrapper: a disabled button does not
                        fire the hover events its own title would need. */}
                    <span
                      title={
                        p.active ? "ปิดใช้งานก่อนถึงจะลบได้" : "ลบโปรโมชั่นนี้"
                      }
                    >
                      <Button
                        variant="danger-soft"
                        size="sm"
                        onPress={() => remove(p.id)}
                        isDisabled={p.active || busyId === p.id}
                      >
                        <Trash2 size={12} /> ลบ
                      </Button>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Below the promos, not above them.
          What is left of each gift decides whether a promo can be kept, so it
          belongs on this page — but it is reference, and at the top it was a
          wall of 29 products that pushed the four promos this page is named
          after entirely below the fold. */}
      <div className="mt-6">
        <GiftStockPanel />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/40 p-4">
          {/* Header and footer hold still; only the middle scrolls.
              The form is long enough that "บันทึก" used to sit a full screen
              below the fold, so the way to finish was out of sight the whole
              time you were working. */}
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl2 bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-surface-line px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-brand-ink">
                {!editingId && step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    aria-label="กลับไปเลือกประเภท"
                    className="text-slate-400 hover:text-brand-ink"
                  >
                    <ChevronDown size={16} className="rotate-90" />
                  </button>
                )}
                {editingId
                  ? "แก้ไขโปรโมชั่น"
                  : step === 0
                    ? "เลือกประเภทแคมเปญ"
                    : (presetTitle ?? "สร้างโปรโมชั่นใหม่")}
              </h2>
              <button onClick={() => setShowForm(false)} aria-label="ปิด">
                <X size={18} />
              </button>
            </div>
            {step === 0 ? (
              /* "Choose campaign type", as the app opens with. The nine cards
                 are presets over the same four settings, not nine kinds of
                 row — but nobody opening this screen is thinking "tiered,
                 quantity, order discount". They are thinking "ยิ่งซื้อยิ่งลด". */
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <p className="mb-3 text-xs text-slate-500">
                  เลือกแบบที่ใกล้เคียงที่สุด — ตั้งค่าทุกอย่างแก้ได้ในขั้นถัดไป
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {CAMPAIGN_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => startFromPreset(preset)}
                      className="flex flex-col rounded-xl2 border-2 border-slate-200 p-3 text-left transition-colors hover:border-brand-teal hover:bg-brand-gradient-soft"
                    >
                      <span className="text-xs font-bold text-brand-ink">{preset.title}</span>
                      <span className="mt-1 text-[11px] leading-snug text-slate-500">{preset.blurb}</span>
                      <span className="mt-2 rounded-lg bg-surface-soft px-2 py-1 text-[10px] text-brand-800">
                        {preset.example}
                      </span>
                    </button>
                  ))}
                  {/* The tenth is not a campaign at all — it lives with the
                      widgets, and saying so here is quicker than letting
                      somebody hunt for it. */}
                  <div className="flex flex-col rounded-xl2 border-2 border-dashed border-slate-200 p-3">
                    <span className="text-xs font-bold text-slate-500">ข้อเสนอหน้าขอบคุณ</span>
                    <span className="mt-1 text-[11px] leading-snug text-slate-400">
                      ไม่ใช่โปรโมชั่น — ตั้งที่หน้า “กล่องโปรโมชั่นหน้าเว็บ”
                    </span>
                  </div>
                </div>
              </div>
            ) : (
            <form onSubmit={submitForm} className="flex min-h-0 flex-1 flex-col">
              {/* Same two steps as the app on Shopify, in the same order and
                  with the same split: the campaign, then how it is shown. */}
              <div className="shrink-0 px-5 pt-4">
                <div className="grid grid-cols-2 gap-1 rounded-xl2 bg-surface-soft p-1">
                  {([1, 2] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setStep(n)}
                      aria-current={step === n}
                      className={`rounded-lg py-2 text-xs font-semibold transition ${
                        step === n ? "bg-white text-brand-ink shadow-card" : "text-slate-500 hover:text-brand-ink"
                      }`}
                    >
                      {n === 1 ? "ขั้นที่ 1: ตั้งค่าแคมเปญ" : "ขั้นที่ 2: การแสดงผล"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid min-h-0 flex-1 items-start gap-5 overflow-y-auto p-5 lg:grid-cols-2 lg:gap-6">
              {/* Left column: what the promo is and who it is for. */}
              <div className="min-w-0 space-y-5">
              {step === 2 ? (
                <>
                  {/* Step 2, laid out like the app's "Display setting": where
                      it shows, and who puts the reward in the cart. */}
                  <div>
                    <p className="mb-2 text-xs font-bold text-brand-ink">หน้าตาของแคมเปญนี้</p>
                    <p className="mb-2 text-[11px] text-slate-500">
                      ปรับเฉพาะแคมเปญนี้ ไม่กระทบตัวอื่น — ไม่แตะเลยจะใช้ค่าตั้งต้นของร้านที่หน้า
                      “กล่องโปรโมชั่นหน้าเว็บ”
                    </p>
                    <GiftWidgetStyleEditor
                      config={form.widgetStyle}
                      onChange={(widgetStyle) => setForm({ ...form, widgetStyle })}
                    />
                    {Object.keys(form.widgetStyle).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, widgetStyle: {} })}
                        className="mt-2 text-[11px] font-semibold text-slate-400 hover:text-brand-ink"
                      >
                        กลับไปใช้ค่าตั้งต้นของร้าน
                      </button>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold text-brand-ink">ตำแหน่งที่แสดง</p>
                    <p className="rounded-lg bg-surface-soft p-3 text-[11px] leading-relaxed text-slate-500">
                      แถบความคืบหน้าและการ์ดของแถมแสดงที่หน้าสินค้าและตะกร้าอยู่แล้ว
                      เปิด/ปิดได้ที่หน้า{" "}
                      <span className="font-semibold text-brand-ink">กล่องโปรโมชั่นหน้าเว็บ</span>{" "}
                      ซึ่งคุมทุกแคมเปญพร้อมกัน ไม่ใช่ทีละตัวแบบแอปบน Shopify
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold text-brand-ink">วิธีให้ของรางวัล</p>
                    <div className="space-y-2">
                      {(
                        [
                          ["auto", "เติมให้อัตโนมัติ", "ของแถมจะเข้าตะกร้าเองเมื่อเข้าเงื่อนไข"],
                          ["customer", "ให้ลูกค้าเลือกเอง", "ลูกค้าเลือกของรางวัลเองเมื่อเข้าเงื่อนไข"],
                        ] as const
                      ).map(([value, title, desc]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setForm({ ...form, giftChoice: value })}
                          className={`flex w-full items-start gap-2.5 rounded-xl border-2 p-3 text-left transition-colors ${
                            form.giftChoice === value
                              ? "border-brand-teal bg-brand-gradient-soft"
                              : "border-slate-200"
                          }`}
                        >
                          <span
                            className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 ${
                              form.giftChoice === value ? "border-brand-teal" : "border-slate-300"
                            }`}
                          >
                            {form.giftChoice === value && (
                              <span className="size-2 rounded-full bg-brand-gradient" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-brand-ink">{title}</span>
                            <span className="mt-0.5 block text-[11px] text-slate-500">{desc}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    {form.giftChoice === "customer" && (
                      <AdminField
                        label="ลูกค้าเลือกได้กี่ชิ้น (ไม่กรอก = เลือกได้ทุกชิ้นที่ลิสต์ไว้)"
                        type="number"
                        inputMode="numeric"
                        value={form.maxGifts}
                        onChange={(v) => setForm({ ...form, maxGifts: v })}
                        placeholder="เช่น 1"
                        className="mt-2"
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
              {/* 1. ชื่อโปร */}
              <div>
                <p className="text-xs font-bold text-brand-ink mb-2">
                  1. ตั้งชื่อโปรโมชั่น
                </p>
                <AdminField
                  label="ชื่อที่ลูกค้าจะเห็น (ภาษาไทย)"
                  value={form.titleTh}
                  onChange={(v) => setForm({ ...form, titleTh: v })}
                  placeholder="เช่น ซื้อครบ 990 รับกระเป๋าฟรี"
                  isRequired
                  className="mb-2"
                />
                <AdminField
                  label="ชื่อภาษาอังกฤษ (ไม่บังคับ)"
                  value={form.titleEn}
                  onChange={(v) => setForm({ ...form, titleEn: v })}
                  placeholder="เช่น Spend ฿990, get a free bag"
                />
              </div>

              {/* 2. เงื่อนไข */}
              <div>
                <p className="text-xs font-bold text-brand-ink mb-2">
                  2. เงื่อนไขการรับของแถม
                </p>
                {/* What the campaign gives. The app sells these as separate
                    campaign types (Order Goal, Volume Discount), but they are
                    this same ladder with money at the top instead of a
                    product — so it is one choice here rather than two more
                    forms to learn. */}
                <div className="mb-3 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["gift", "ให้ของแถม", "ลูกค้าได้สินค้าเพิ่มในตะกร้า"],
                      ["order_discount", "ลดท้ายบิล", "หักเงินจากยอดรวม ไม่ได้ของเพิ่ม"],
                    ] as const
                  ).map(([value, title, desc]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm({ ...form, rewardType: value })}
                      className={`rounded-xl border-2 p-2.5 text-left transition-colors ${
                        form.rewardType === value
                          ? "border-brand-teal bg-brand-gradient-soft"
                          : "border-slate-200"
                      }`}
                    >
                      <span className="block text-xs font-bold text-brand-ink">{title}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">{desc}</span>
                    </button>
                  ))}
                </div>

                {/* "Tiered reward type" — the app asks this before the
                    milestones, because it decides what the numbers under them
                    mean. */}
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-surface-soft px-3 py-2">
                  <span className="text-[11px] font-semibold text-brand-ink">นับจาก</span>
                  {(
                    [
                      ["cart-value", "ยอดรวมตะกร้า"],
                      ["quantity", "จำนวนชิ้น"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm({ ...form, triggerType: value })}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-ink"
                    >
                      <span
                        className={`grid size-4 place-items-center rounded-full border-2 ${
                          form.triggerType === value ? "border-brand-teal" : "border-slate-300"
                        }`}
                      >
                        {form.triggerType === value && (
                          <span className="size-2 rounded-full bg-brand-gradient" />
                        )}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>

                <SubConditions
                  open={showSubConditions}
                  onToggle={() => setShowSubConditions((v) => !v)}
                  form={form}
                  setForm={setForm}
                />

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, kind: "spend" })}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      form.kind === "spend"
                        ? "border-brand-teal bg-brand-gradient-soft"
                        : "border-slate-200"
                    }`}
                  >
                    <ShoppingBag
                      size={16}
                      className="text-brand-emerald mb-1"
                    />
                    <p className="text-xs font-bold text-brand-ink">
                      ซื้อครบยอด
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      ซื้ออะไรก็ได้ครบยอดที่กำหนด
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, kind: "bxgy" })}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      form.kind === "bxgy"
                        ? "border-brand-teal bg-brand-gradient-soft"
                        : "border-slate-200"
                    }`}
                  >
                    <Layers size={16} className="text-brand-emerald mb-1" />
                    <p className="text-xs font-bold text-brand-ink">
                      ซื้อครบจำนวน
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      ต้องซื้อสินค้าที่กำหนดครบจำนวน
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, kind: "tiered" })}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      form.kind === "tiered"
                        ? "border-brand-teal bg-brand-gradient-soft"
                        : "border-slate-200"
                    }`}
                  >
                    <TrendingUp size={16} className="text-brand-emerald mb-1" />
                    <p className="text-xs font-bold text-brand-ink">
                      แบบขั้นบันได
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      ยิ่งซื้อเยอะ ยิ่งได้ของแถมมากขึ้น
                    </p>
                  </button>
                </div>

                {form.kind === "spend" ? (
                  <AdminField
                    label={form.triggerType === "quantity" ? "จำนวนขั้นต่ำ (ชิ้น)" : "ยอดขั้นต่ำ (บาท)"}
                    type="number"
                    inputMode="numeric"
                    value={form.minSubtotal}
                    onChange={(v) => setForm({ ...form, minSubtotal: v })}
                    placeholder={form.triggerType === "quantity" ? "เช่น 3" : "เช่น 990"}
                    isRequired
                  />
                ) : form.kind === "bxgy" ? (
                  <div className="space-y-2">
                    <label className="block text-[11px] text-slate-400">
                      สินค้าที่ลูกค้าต้องซื้อ (เลือกได้หลายชิ้น)
                    </label>
                    {form.buyProductSlugs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {form.buyProductSlugs.map((s) => {
                          const p = getProductBySlug(s);
                          return (
                            <span
                              key={s}
                              className="flex items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1 text-xs"
                            >
                              {p?.name ?? s}
                              <button
                                type="button"
                                onClick={() =>
                                  setForm({
                                    ...form,
                                    buyProductSlugs:
                                      form.buyProductSlugs.filter(
                                        (x) => x !== s,
                                      ),
                                  })
                                }
                              >
                                <X size={11} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <ProductPicker
                      onSelect={(slug) =>
                        setForm((f) => ({
                          ...f,
                          buyProductSlugs: f.buyProductSlugs.includes(slug)
                            ? f.buyProductSlugs
                            : [...f.buyProductSlugs, slug],
                        }))
                      }
                    />
                    <AdminField
                      label="จำนวนที่ต้องซื้อรวม (ชิ้น)"
                      type="number"
                      inputMode="numeric"
                      value={form.buyQty}
                      onChange={(v) => setForm({ ...form, buyQty: v })}
                      placeholder="เช่น 2"
                      isRequired
                      className="mt-2"
                    />
                  </div>
                ) : null}
              </div>

                </>
              )}
              </div>

              {/* Right column: what the shopper walks away with, and the
                  sentence they will read. Beside the conditions rather than a
                  screen below them, so the two can be checked against each
                  other without scrolling between them. */}
              <div className="min-w-0 space-y-5">
              {step === 2 ? (
                /* The app shows a summary beside the display settings rather
                   than the reward editor again — on this step the question is
                   how the campaign appears, and the reward is settled. */
                <div className="rounded-xl2 border border-surface-line p-4">
                  <p className="mb-2 text-xs font-bold text-brand-ink">สรุปแคมเปญ</p>
                  <dl className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">แบบ</dt>
                      <dd className="font-semibold text-brand-ink">
                        {form.kind === "tiered"
                          ? "ขั้นบันได"
                          : form.kind === "bxgy"
                            ? "ซื้อครบจำนวน"
                            : "ซื้อครบยอด"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">นับจาก</dt>
                      <dd className="font-semibold text-brand-ink">
                        {form.triggerType === "quantity" ? "จำนวนชิ้น" : "ยอดรวมตะกร้า"}
                      </dd>
                    </div>
                    {form.kind === "tiered" ? (
                      form.tiers.map((t, i) => (
                        <div key={i} className="flex justify-between gap-3">
                          <dt className="text-slate-500">
                            ระดับ {i + 1} ·{" "}
                            {form.triggerType === "quantity"
                              ? `${t.minSubtotal || 0} ชิ้น`
                              : `฿${Number(t.minSubtotal || 0).toLocaleString()}`}
                          </dt>
                          <dd className="min-w-0 text-right font-semibold text-brand-ink">
                            {describeGifts(t.gifts, shelfNameFor)}
                          </dd>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">ของรางวัล</dt>
                        <dd className="min-w-0 text-right font-semibold text-brand-ink">
                          {describeGifts(form.gifts, shelfNameFor)}
                        </dd>
                      </div>
                    )}
                    {(form.excludedProductSlugs.length > 0 ||
                      form.scopeBrands.length > 0 ||
                      form.scopeCategories.length > 0 ||
                      form.customerTiers.length > 0 ||
                      form.firstOrderOnly ||
                      form.minQty !== "") && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">เงื่อนไขย่อย</dt>
                        <dd className="text-right font-semibold text-brand-ink">
                          {[
                            form.excludedProductSlugs.length > 0 &&
                              `ยกเว้น ${form.excludedProductSlugs.length} รายการ`,
                            form.scopeBrands.length > 0 && `${form.scopeBrands.length} แบรนด์`,
                            form.scopeCategories.length > 0 && `${form.scopeCategories.length} หมวด`,
                            form.customerTiers.length > 0 && form.customerTiers.join("/"),
                            form.firstOrderOnly && "ออเดอร์แรก",
                            form.minQty && `≥ ${form.minQty} ชิ้น`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              ) : (
                <>
              {/* The levels live here rather than under the condition picker:
                  they are the longest thing in the form and they are what the
                  shopper gets, which is this column's subject. Beside the
                  conditions they also stopped being a column of half-width
                  cards with an empty half-screen next to them. */}
              {form.kind === "tiered" && (
                <div>
                  <p className="text-xs font-bold text-brand-ink mb-2">
                    3. ระดับและของแถม
                  </p>
                    <div className="space-y-3">
                      <label className="block text-[11px] text-slate-400">
                        ตั้งระดับยอดซื้อ → ของแถมของระดับนั้น (เรียงจากน้อยไปมาก
                        ระดับหลังจะได้ของแถมของระดับก่อนหน้าด้วย)
                      </label>
                      {form.tiers.map((tier, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-slate-200 p-2.5 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-brand-ink">
                              ระดับ {i + 1}
                            </span>
                            {form.tiers.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setForm({
                                    ...form,
                                    tiers: form.tiers.filter(
                                      (_, idx) => idx !== i,
                                    ),
                                  })
                                }
                              >
                                <X size={13} className="text-slate-400" />
                              </button>
                            )}
                          </div>
                          <AdminField
                            label={`${
                              form.triggerType === "quantity" ? "จำนวนขั้นต่ำ" : "ยอดขั้นต่ำ"
                            }ของระดับที่ ${i + 1} (${form.triggerType === "quantity" ? "ชิ้น" : "บาท"})`}
                            type="number"
                            inputMode="numeric"
                            value={tier.minSubtotal}
                            onChange={(v) => {
                              const next = [...form.tiers];
                              next[i] = { ...next[i], minSubtotal: v };
                              setForm({ ...form, tiers: next });
                            }}
                            placeholder={
                            form.triggerType === "quantity"
                              ? "จำนวนชิ้นขั้นต่ำของระดับนี้"
                              : "ยอดขั้นต่ำของระดับนี้ (บาท)"
                          }
                            isRequired
                          />
                          <DiscountTypeField
                            label={`ประเภทของรางวัลระดับที่ ${i + 1}`}
                            allowInherit
                            type={tier.discountType}
                            value={tier.discountValue}
                            onChange={(discountType, discountValue) => {
                              const tiers = [...form.tiers];
                              tiers[i] = { ...tiers[i], discountType, discountValue };
                              setForm({ ...form, tiers });
                            }}
                          />
                          {form.rewardType === "gift" && (
                          <GiftListField
                            label={`ของแถมในระดับที่ ${i + 1}`}
                            gifts={tier.gifts}
                            onChange={(next) => {
                              const tiers = [...form.tiers];
                              tiers[i] = { ...tiers[i], gifts: next };
                              setForm({ ...form, tiers });
                            }}
                          />
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            tiers: [...form.tiers, { ...EMPTY_TIER_ROW }],
                          })
                        }
                        className="flex items-center gap-1 text-xs font-semibold text-brand-800"
                      >
                        <Plus size={13} /> เพิ่มระดับ
                      </button>
                    </div>
                </div>
              )}
              {/* 3. The reward itself. A campaign that discounts the order
                  still has to say by how much — gating the whole section on
                  "gift" left the ลดท้ายบิล campaigns with nowhere to type a
                  percentage and a Save button that could never enable. */}
              {form.kind !== "tiered" && (
                <div>
                  <p className="text-xs font-bold text-brand-ink mb-2">
                    {form.rewardType === "order_discount" ? "3. ส่วนลดท้ายบิล" : "3. สินค้าที่จะแถมฟรี"}
                  </p>
                  {/* The shop's free-gift shelf, not the catalogue: every gift
                      is UNLISTED in Shopify on purpose and none of them appears
                      in the catalogue the other picker reads. */}
                  <DiscountTypeField
                    label={
                      form.rewardType === "order_discount" ? "ลดเท่าไหร่" : "ประเภทของรางวัล"
                    }
                    type={form.discountType}
                    value={form.discountValue}
                    onChange={(discountType, discountValue) =>
                      setForm({
                        ...form,
                        discountType: (discountType || "free") as FormState["discountType"],
                        discountValue,
                      })
                    }
                  />
                  {form.rewardType === "gift" && (
                    <>
                      <div className="h-2" />
                      <GiftListField
                        label="ของแถมที่ลูกค้าจะได้รับ"
                        gifts={form.gifts}
                        onChange={(gifts) => setForm({ ...form, gifts })}
                      />
                    </>
                  )}
                </div>
              )}

              {/* preview */}
              {form.titleTh &&
                (form.kind === "tiered"
                  ? form.tiers.some((t) => t.gifts.length > 0)
                  : form.gifts.length > 0) && (
                  <div className="rounded-xl bg-brand-gradient-soft p-3">
                    <p className="text-[10px] font-bold text-brand-800 uppercase mb-1">
                      ตัวอย่างที่ลูกค้าจะเห็น
                    </p>
                    <p className="text-xs text-brand-ink">
                      {describeCondition(form)}
                      {form.kind !== "tiered" && ` → รับฟรี ${describeGifts(form.gifts, shelfNameFor)}`}
                    </p>
                    {form.kind === "tiered" && (
                      <ul className="mt-1 space-y-0.5">
                        {form.tiers.map((t, i) => (
                          <li key={i} className="text-[11px] text-brand-ink">
                            ฿{Number(t.minSubtotal || 0).toLocaleString()} → {describeGifts(t.gifts, shelfNameFor)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                </>
              )}
              {/* advanced (optional) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown
                    size={12}
                    className={
                      showAdvanced
                        ? "rotate-180 transition-transform"
                        : "transition-transform"
                    }
                  />
                  ตั้งค่าขั้นสูง (ไม่จำเป็นต้องกรอก)
                </button>
                {showAdvanced && (
                  <div className="mt-2 space-y-2">
                    <AdminField
                      label="slug (รหัสอ้างอิงภายใน ไม่กรอก = สร้างให้อัตโนมัติ)"
                      value={form.slug}
                      onChange={(v) => setForm({ ...form, slug: slugify(v) })}
                      isDisabled={Boolean(editingId)}
                    />
                    <AdminField
                      label="วันเริ่ม (ไม่บังคับ)"
                      type="date"
                      value={form.starts}
                      onChange={(v) => setForm({ ...form, starts: v })}
                    />
                    <AdminField
                      label="วันหมดอายุ (ไม่บังคับ)"
                      type="date"
                      value={form.expires}
                      onChange={(v) => setForm({ ...form, expires: v })}
                    />
                  </div>
                )}
              </div>

              </div>
              </div>

              <div className="shrink-0 space-y-2 border-t border-surface-line px-5 py-4">
              {formError && (
                <p className="text-xs text-rose-500">{formError}</p>
              )}
              <button
                type="submit"
                disabled={
                  submitting ||
                  // The gift is a Shopify variant now, not a catalogue slug:
                  // watching the old field left this disabled however many
                  // gifts were picked.
                  (form.rewardType === "order_discount"
                    ? // Money off the order needs a number, not a product.
                      form.kind === "tiered"
                      ? !form.tiers.every((t) => Number(t.discountValue || form.discountValue) > 0)
                      : Number(form.discountValue) <= 0
                    : form.kind === "tiered"
                      ? !form.tiers.every((t) => t.gifts.length > 0)
                      : form.gifts.length === 0)
                }
                className="w-full rounded-full bg-brand-gradient text-white text-sm font-semibold py-3 disabled:opacity-50"
              >
                {submitting
                  ? "กำลังบันทึก…"
                  : "บันทึกเป็นร่าง (ยังไม่เปิดใช้งาน)"}
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                บันทึกแล้วยังไม่มีผลกับลูกค้า ต้องกด
                &ldquo;เปิดใช้งานจริง&rdquo; ในหน้ารายการอีกครั้ง
              </p>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
