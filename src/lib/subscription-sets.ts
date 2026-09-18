// Curated subscription sets — a bundle the shop assembles, prices and sells as
// one subscription (the third option beside "subscribe to this product" and
// "build your own box").
//
// Two rules from the plan live here. A set is only sellable when every product
// in it is in stock: a bundle is a promise about its contents, so one missing
// item hides the whole set rather than quietly shipping a substitute. And its
// price is fixed — a set must not re-price itself because one of its products
// went on sale.
import { getProductBySlug } from "@/data/products";
import { supabaseRest } from "@/lib/supabase-server";

export type SubscriptionSetStatus = "draft" | "active" | "archived";

export type SubscriptionSetItem = {
  id?: string;
  product_slug: string;
  product_variant_id: string | null;
  quantity: number;
};

export type SubscriptionSet = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  bundle_price: number | string;
  status: SubscriptionSetStatus;
  interval_days: number;
  shopify_bundle_product_id: string | null;
  created_at: string;
  updated_at: string;
  subscription_set_items?: SubscriptionSetItem[];
};

export const SET_COLUMNS =
  "id,name,description,image_url,bundle_price,status,interval_days,shopify_bundle_product_id,created_at,updated_at,subscription_set_items(id,product_slug,product_variant_id,quantity)";

export const STATUS_TH: Record<SubscriptionSetStatus, string> = {
  draft: "ฉบับร่าง",
  active: "เปิดขาย",
  archived: "เก็บเข้าคลัง",
};

export const INTERVALS = [30, 45, 60, 90] as const;

/** Item lines with what the catalogue knows: name, image, price, stock. */
export function describeItems(items: SubscriptionSetItem[] = []) {
  return items.map((item) => {
    const product = getProductBySlug(item.product_slug);
    const price = product?.variants.find((v) => v.variantId === (item.product_variant_id ?? product?.variantId))?.price ?? product?.price ?? 0;
    return {
      ...item,
      name: product?.name ?? item.product_slug,
      image: product?.image ?? null,
      brand: product?.brand ?? "",
      unitPrice: price,
      lineTotal: price * item.quantity,
      inStock: Boolean(product?.inStock),
      missing: !product,
    };
  });
}

/**
 * What the set is worth bought separately, what it costs as a set, and whether
 * it can be sold at all today.
 */
export function setSummary(set: SubscriptionSet) {
  const items = describeItems(set.subscription_set_items);
  const separately = items.reduce((total, i) => total + i.lineTotal, 0);
  const bundle = Number(set.bundle_price);
  const outOfStock = items.filter((i) => !i.inStock || i.missing);
  return {
    items,
    separately,
    bundle,
    saving: separately > bundle ? separately - bundle : 0,
    savingPercent: separately > bundle ? Math.round((1 - bundle / separately) * 100) : 0,
    outOfStock,
    // Active and everything in it is in stock; anything else is not for sale.
    sellable: set.status === "active" && items.length > 0 && outOfStock.length === 0,
  };
}

type Input = { row: Record<string, unknown>; items: SubscriptionSetItem[] };

const MAX_ITEMS = 10;

/** Validates what the admin form sends; returns the row and its items, or a Thai error. */
export function parseSetInput(body: unknown): Input | { error: string } {
  if (!body || typeof body !== "object") return { error: "ข้อมูลไม่ถูกต้อง" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 150) return { error: "กรุณาตั้งชื่อชุด (ไม่เกิน 150 ตัวอักษร)" };

  const rawItems = Array.isArray(b.items) ? b.items : [];
  const items: SubscriptionSetItem[] = [];
  for (const raw of rawItems) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const slug = typeof item.product_slug === "string" ? item.product_slug : "";
    const product = getProductBySlug(slug);
    if (!product) return { error: `ไม่พบสินค้า: ${slug || "(ไม่ระบุ)"}` };
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return { error: `จำนวนของ ${product.name} ต้องอยู่ระหว่าง 1–20` };
    if (items.some((i) => i.product_slug === slug)) return { error: `${product.name} ถูกใส่ในชุดซ้ำ` };
    items.push({ product_slug: slug, product_variant_id: product.variantId ?? null, quantity });
  }
  if (items.length < 2) return { error: "ชุดต้องมีสินค้าอย่างน้อย 2 รายการ" };
  if (items.length > MAX_ITEMS) return { error: `ชุดใส่สินค้าได้ไม่เกิน ${MAX_ITEMS} รายการ` };

  const price = Number(b.bundle_price);
  if (!Number.isFinite(price) || price <= 0) return { error: "กรุณากรอกราคาชุด" };
  const separately = describeItems(items).reduce((total, i) => total + i.lineTotal, 0);
  if (price > separately) return { error: `ราคาชุดต้องไม่แพงกว่าซื้อแยก (฿${separately.toLocaleString("th-TH")})` };

  const status: SubscriptionSetStatus = b.status === "active" || b.status === "archived" ? b.status : "draft";
  const interval = INTERVALS.includes(Number(b.interval_days) as (typeof INTERVALS)[number]) ? Number(b.interval_days) : 30;

  const image = typeof b.image_url === "string" && b.image_url.trim() ? b.image_url.trim().slice(0, 1000) : null;

  return {
    items,
    row: {
      name,
      description: typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 2000) : null,
      image_url: image,
      bundle_price: Math.round(price * 100) / 100,
      status,
      interval_days: interval,
    },
  };
}

/** Replace a set's items (they are always written as a whole). */
export async function writeItems(setId: string, items: SubscriptionSetItem[]) {
  await supabaseRest(`subscription_set_items?set_id=eq.${setId}`, { method: "DELETE", returning: false });
  if (items.length === 0) return;
  await supabaseRest("subscription_set_items", {
    method: "POST",
    returning: false,
    body: JSON.stringify(items.map((i) => ({ ...i, set_id: setId }))),
  });
}
