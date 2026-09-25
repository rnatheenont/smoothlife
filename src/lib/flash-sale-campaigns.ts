// Flash-sale campaigns as stored in `flash_sale_campaigns` (see the
// create_flash_sale_campaigns migration) and as the admin API hands them to
// the browser. Server-only validation lives here so the create route and any
// later caller agree on what a valid campaign is.
import { getProductBySlug } from "@/data/products";
import { publicStorageHost } from "@/lib/public-uploads";

/** Which sale page the campaign gets: the plain one, or the branded drop page. */
export type CampaignKind = "regular" | "special";

/** The look of a "special" campaign's sale page — banner, colour and Q&A. */
export type HeroAlign = "top" | "center" | "bottom";

export type CampaignPresentation = {
  heroImage: string | null;
  heroHeadline: string | null;
  heroNote: string | null;
  heroAlign: HeroAlign;
  accent: string | null;
  faq: { q: string; a: string }[];
};

export const DEFAULT_ACCENT = "#952ede";

export type FlashSaleCampaignRow = {
  id: string;
  title: string;
  mode: "single" | "group";
  kind: CampaignKind;
  hero_image_url: string | null;
  hero_headline: string | null;
  hero_note: string | null;
  hero_align: HeroAlign;
  accent_color: string | null;
  faq: { q: string; a: string }[];
  group_kind: "category" | "brand" | "collection" | null;
  group_key: string | null;
  product_slugs: string[];
  stock_per_product: number;
  reservation_window_minutes: number;
  max_requeue_per_customer: number;
  starts_at: string;
  ends_at: string | null;
  ended_manually_at: string | null;
  published?: boolean | null;
  created_at: string;
  /** Embedded from flash_sales (one row per product). */
  flash_sales?: { product_slug: string; sale_price: number | string | null }[];
};

export const CAMPAIGN_COLUMNS =
  "id,title,mode,kind,published,hero_image_url,hero_headline,hero_note,hero_align,accent_color,faq,group_kind,group_key,product_slugs,stock_per_product,reservation_window_minutes,max_requeue_per_customer,starts_at,ends_at,ended_manually_at,created_at,flash_sales(product_slug,sale_price)";

/** What the admin page receives: times as epoch ms. */
export type FlashSaleCampaignDTO = {
  id: string;
  title: string;
  mode: "single" | "group";
  kind: CampaignKind;
  presentation: CampaignPresentation;
  groupKind: FlashSaleCampaignRow["group_kind"];
  groupKey: string | null;
  productSlugs: string[];
  stockPerProduct: number;
  windowMinutes: number;
  maxRequeue: number;
  startsAt: number;
  endsAt: number | null;
  endedManuallyAt: number | null;
  /** Whether the sale page answers for customers at all. */
  published: boolean;
  /** Flash price per product slug; null = regular price. */
  salePrices: Record<string, number | null>;
};

export function rowToCampaign(r: FlashSaleCampaignRow): FlashSaleCampaignDTO {
  return {
    id: r.id,
    title: r.title,
    mode: r.mode,
    kind: r.kind === "special" ? "special" : "regular",
    presentation: {
      heroImage: r.hero_image_url,
      heroHeadline: r.hero_headline,
      heroNote: r.hero_note,
      heroAlign: r.hero_align === "center" || r.hero_align === "bottom" ? r.hero_align : "top",
      accent: r.accent_color,
      faq: Array.isArray(r.faq) ? r.faq : [],
    },
    groupKind: r.group_kind,
    groupKey: r.group_key,
    productSlugs: r.product_slugs,
    stockPerProduct: r.stock_per_product,
    windowMinutes: r.reservation_window_minutes,
    maxRequeue: r.max_requeue_per_customer,
    startsAt: Date.parse(r.starts_at),
    endsAt: r.ends_at ? Date.parse(r.ends_at) : null,
    endedManuallyAt: r.ended_manually_at ? Date.parse(r.ended_manually_at) : null,
    // A row written before the column existed is a sale that has been live.
    published: r.published !== false,
    salePrices: Object.fromEntries(
      (r.flash_sales ?? []).map((s) => [s.product_slug, s.sale_price === null ? null : Number(s.sale_price)])
    ),
  };
}

/** The price a product sells for outside the flash sale: its default variant's. */
export function regularPrice(slug: string): number | null {
  const p = getProductBySlug(slug);
  if (!p) return null;
  return p.variants.find((v) => v.variantId === p.variantId)?.price ?? p.price;
}

export type PricingInput =
  | { mode: "regular" }
  | { mode: "percent"; percent: number }
  | { mode: "fixed"; prices: Record<string, number> };

const MAX_PRODUCTS = 12;

/** A banner has to come from our own storefront, Shopify's CDN, or our own
 *  public upload bucket (see /api/admin/flash-sale/upload-image) — it is
 *  rendered on the sale page. */
const IMAGE_HOSTS = ["cdn.shopify.com", "www.smoothlife.com", "smoothlife.com", publicStorageHost()].filter(
  (h): h is string => Boolean(h)
);

function parseHeroImage(value: unknown): string | null | { error: string } {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 1000) return { error: "ลิงก์รูปแบนเนอร์ไม่ถูกต้อง" };
  // Files shipped with the site are allowed as-is.
  if (value.startsWith("/")) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { error: "ลิงก์รูปแบนเนอร์ไม่ถูกต้อง" };
  }
  if (url.protocol !== "https:" || !IMAGE_HOSTS.includes(url.hostname)) {
    return { error: `รูปแบนเนอร์ต้องเป็นลิงก์ https จาก ${IMAGE_HOSTS.join(" หรือ ")}` };
  }
  return url.toString();
}

/** The "special" campaign's page dressing; ignored for regular campaigns. */
function parsePresentation(b: Record<string, unknown>): Pick<FlashSaleCampaignRow, "hero_image_url" | "hero_headline" | "hero_note" | "hero_align" | "accent_color" | "faq"> | { error: string } {
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const hero = parseHeroImage(b.heroImage);
  if (hero !== null && typeof hero === "object") return hero;

  const accent = text(b.accent, 7);
  if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) return { error: "สีหลักต้องเป็นรหัสสีแบบ #RRGGBB" };

  const rawFaq = Array.isArray(b.faq) ? b.faq : [];
  if (rawFaq.length > 20) return { error: "คำถามที่พบบ่อยใส่ได้ไม่เกิน 20 ข้อ" };
  const faq = rawFaq
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return { q: text(row.q, 200) ?? "", a: text(row.a, 1000) ?? "" };
    })
    .filter((row) => row.q && row.a);

  const heroAlign: HeroAlign = b.heroAlign === "center" || b.heroAlign === "bottom" ? b.heroAlign : "top";

  return {
    hero_image_url: hero as string | null,
    hero_headline: text(b.heroHeadline, 120),
    hero_note: text(b.heroNote, 300),
    hero_align: heroAlign,
    accent_color: accent,
    faq,
  };
}

/** Validates a create request; returns the row to insert or a Thai error message. */
export function parseCampaignInput(
  body: unknown
): { row: Omit<FlashSaleCampaignRow, "id" | "created_at" | "ended_manually_at">; salePrices: Record<string, number | null> } | { error: string } {
  if (!body || typeof body !== "object") return { error: "ข้อมูลไม่ถูกต้อง" };
  const b = body as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title || title.length > 200) return { error: "กรุณาตั้งชื่อแคมเปญ (ไม่เกิน 200 ตัวอักษร)" };

  const mode = b.mode;
  if (mode !== "single" && mode !== "group") return { error: "ประเภทแคมเปญไม่ถูกต้อง" };
  const kind: CampaignKind = b.kind === "special" ? "special" : "regular";
  const presentation = parsePresentation(b);
  if ("error" in presentation) return { error: presentation.error };
  const groupKind = mode === "group" ? b.groupKind : null;
  const groupKey = mode === "group" && typeof b.groupKey === "string" ? b.groupKey.slice(0, 200) : null;
  if (mode === "group" && (!["category", "brand", "collection"].includes(String(groupKind)) || !groupKey)) {
    return { error: "กรุณาเลือกกลุ่มสินค้า" };
  }

  const slugs = Array.isArray(b.productSlugs) ? [...new Set(b.productSlugs.filter((s): s is string => typeof s === "string"))] : [];
  if (slugs.length === 0) return { error: "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ" };
  if (slugs.length > MAX_PRODUCTS) return { error: `เลือกสินค้าได้ไม่เกิน ${MAX_PRODUCTS} รายการต่อแคมเปญ` };
  if (mode === "single" && slugs.length !== 1) return { error: "แคมเปญสินค้าชิ้นเดียวต้องมีสินค้า 1 รายการ" };
  const missing = slugs.find((s) => !getProductBySlug(s));
  if (missing) return { error: `ไม่พบสินค้า: ${missing}` };

  const int = (v: unknown, min: number, max: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null);
  const stock = int(b.stockPerProduct, 1, 10000);
  if (stock === null) return { error: "สต็อกต่อสินค้าต้องเป็น 1–10,000 ชิ้น" };
  const windowMinutes = int(b.windowMinutes, 1, 120);
  if (windowMinutes === null) return { error: "เวลาชำระเงินต้องอยู่ระหว่าง 1–120 นาที" };
  const maxRequeue = int(b.maxRequeue, 0, 10);
  if (maxRequeue === null) return { error: "จำนวนครั้งที่กลับเข้าคิวต้องอยู่ระหว่าง 0–10" };

  const startsAt = typeof b.startsAt === "number" && Number.isFinite(b.startsAt) ? b.startsAt : NaN;
  if (Number.isNaN(startsAt)) return { error: "กรุณาเลือกวันเวลาเริ่มขาย" };
  const endsAt = b.endsAt === null || b.endsAt === undefined ? null : typeof b.endsAt === "number" && Number.isFinite(b.endsAt) ? b.endsAt : NaN;
  if (Number.isNaN(endsAt)) return { error: "วันเวลาปิดการขายไม่ถูกต้อง" };
  if (endsAt !== null && endsAt <= startsAt) return { error: "เวลาปิดการขายต้องหลังเวลาเริ่มขาย" };

  // Flash price per product, resolved to baht here so the row holds the exact
  // amount charged. Never above the regular price; whole baht for "% off".
  const pricing = (b.pricing ?? { mode: "regular" }) as PricingInput;
  const salePrices: Record<string, number | null> = {};
  for (const slug of slugs) {
    const regular = regularPrice(slug)!;
    if (pricing.mode === "regular") {
      salePrices[slug] = null;
    } else if (pricing.mode === "percent") {
      const pct = Number(pricing.percent);
      if (!Number.isFinite(pct) || pct < 1 || pct > 90) return { error: "ส่วนลดต้องอยู่ระหว่าง 1–90%" };
      salePrices[slug] = Math.max(1, Math.round(regular * (1 - pct / 100)));
    } else if (pricing.mode === "fixed") {
      const price = Number(pricing.prices?.[slug]);
      if (!Number.isFinite(price) || price <= 0) return { error: `กรุณากรอกราคา Flash Sale ให้ครบทุกสินค้า (${getProductBySlug(slug)?.name ?? slug})` };
      if (price > regular) return { error: `ราคา Flash Sale ต้องไม่สูงกว่าราคาปกติ ฿${regular} (${getProductBySlug(slug)?.name ?? slug})` };
      salePrices[slug] = Math.round(price * 100) / 100;
    } else {
      return { error: "รูปแบบราคาไม่ถูกต้อง" };
    }
  }

  return {
    salePrices,
    row: {
      title,
      mode,
      kind,
      // A regular campaign keeps the plain page, so its dressing is not stored.
      ...(kind === "special"
        ? presentation
        : { hero_image_url: null, hero_headline: null, hero_note: null, hero_align: "top" as const, accent_color: null, faq: [] }),
      group_kind: groupKind as FlashSaleCampaignRow["group_kind"],
      group_key: groupKey,
      product_slugs: slugs,
      stock_per_product: stock,
      reservation_window_minutes: windowMinutes,
      max_requeue_per_customer: maxRequeue,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt === null ? null : new Date(endsAt).toISOString(),
    },
  };
}
