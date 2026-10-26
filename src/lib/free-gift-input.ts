import type { FreeGiftItemRow } from "../data/free-gifts.ts";

// What the admin form is allowed to say a promo hands over.
//
// Both admin routes need the same answer, and they are the last thing between
// a typo and a campaign that gives away the wrong product to every customer —
// so the rules live in one place with tests on them rather than twice, by
// hand, slightly differently.

export type GiftInput = { variantId?: unknown; qty?: unknown };

const VARIANT_PREFIX = "gid://shopify/ProductVariant/";

/** A gift must be a real variant from the shop's free-gift shelf. The shelf
 *  is the only place these products exist — they are unlisted in Shopify and
 *  none of them is in the catalogue — so a slug or a bare number is not
 *  something we can hand to an order. */
function validVariant(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(VARIANT_PREFIX) && v.length > VARIANT_PREFIX.length;
}

export type GiftNormaliseResult =
  | { ok: true; gifts: FreeGiftItemRow[] }
  | { ok: false; error: string };

/**
 * One level's gifts, checked and tidied for storage.
 *
 * Quantities are whole and positive; the same gift chosen twice becomes one
 * line with the quantities added, because that is plainly what was meant and
 * two lines for one variant would reach Shopify as two line items of the
 * same thing.
 */
export function normaliseGifts(input: unknown, where: string): GiftNormaliseResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: `กรุณาเลือกของแถมอย่างน้อย 1 ชิ้น${where}` };
  }
  if (input.length > 10) {
    return { ok: false, error: `ของแถม${where}มากเกินไป (สูงสุด 10 ชิ้น)` };
  }

  const merged = new Map<string, number>();
  for (const raw of input as GiftInput[]) {
    if (!validVariant(raw?.variantId)) {
      return { ok: false, error: `กรุณาเลือกของแถม${where}จากรายการของแถมใน Shopify` };
    }
    const qty = Number(raw.qty ?? 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { ok: false, error: `จำนวนของแถม${where}ต้องเป็นจำนวนเต็ม 1–99` };
    }
    merged.set(raw.variantId, (merged.get(raw.variantId) ?? 0) + qty);
  }

  return {
    ok: true,
    gifts: [...merged].map(([variant_id, qty]) => ({ variant_id, product_slug: "", qty })),
  };
}
