// Flash-sale campaigns as stored in `flash_sale_campaigns` (see the
// create_flash_sale_campaigns migration) and as the admin API hands them to
// the browser. Server-only validation lives here so the create route and any
// later caller agree on what a valid campaign is.
import { getProductBySlug } from "@/data/products";

export type FlashSaleCampaignRow = {
  id: string;
  title: string;
  mode: "single" | "group";
  group_kind: "category" | "brand" | "collection" | null;
  group_key: string | null;
  product_slugs: string[];
  stock_per_product: number;
  reservation_window_minutes: number;
  max_requeue_per_customer: number;
  starts_at: string;
  ends_at: string | null;
  ended_manually_at: string | null;
  created_at: string;
};

export const CAMPAIGN_COLUMNS =
  "id,title,mode,group_kind,group_key,product_slugs,stock_per_product,reservation_window_minutes,max_requeue_per_customer,starts_at,ends_at,ended_manually_at,created_at";

/** What the admin page receives: times as epoch ms. */
export type FlashSaleCampaignDTO = {
  id: string;
  title: string;
  mode: "single" | "group";
  groupKind: FlashSaleCampaignRow["group_kind"];
  groupKey: string | null;
  productSlugs: string[];
  stockPerProduct: number;
  windowMinutes: number;
  maxRequeue: number;
  startsAt: number;
  endsAt: number | null;
  endedManuallyAt: number | null;
};

export function rowToCampaign(r: FlashSaleCampaignRow): FlashSaleCampaignDTO {
  return {
    id: r.id,
    title: r.title,
    mode: r.mode,
    groupKind: r.group_kind,
    groupKey: r.group_key,
    productSlugs: r.product_slugs,
    stockPerProduct: r.stock_per_product,
    windowMinutes: r.reservation_window_minutes,
    maxRequeue: r.max_requeue_per_customer,
    startsAt: Date.parse(r.starts_at),
    endsAt: r.ends_at ? Date.parse(r.ends_at) : null,
    endedManuallyAt: r.ended_manually_at ? Date.parse(r.ended_manually_at) : null,
  };
}

const MAX_PRODUCTS = 12;

/** Validates a create request; returns the row to insert or a Thai error message. */
export function parseCampaignInput(body: unknown): { row: Omit<FlashSaleCampaignRow, "id" | "created_at" | "ended_manually_at"> } | { error: string } {
  if (!body || typeof body !== "object") return { error: "ข้อมูลไม่ถูกต้อง" };
  const b = body as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title || title.length > 200) return { error: "กรุณาตั้งชื่อแคมเปญ (ไม่เกิน 200 ตัวอักษร)" };

  const mode = b.mode;
  if (mode !== "single" && mode !== "group") return { error: "ประเภทแคมเปญไม่ถูกต้อง" };
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

  return {
    row: {
      title,
      mode,
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
