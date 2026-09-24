// DENTISTE'S x KENG NAMPING — how a receipt turns into entries.
//
// The amount is never read off the photo. payment_transactions is written only
// when someone pays through 2C2P on this site, so the line items on the row are
// what was actually bought here, at the price actually charged — which is also
// how "must be bought from Smoothlife.com, not a marketplace" is enforced
// without anyone squinting at a picture. The photo is the customer's proof to
// hold, and the admin's cross-check; the arithmetic comes from the order.
//
// Two rules in the campaign document contradict each other, so both are
// implemented and one switch decides. Condition 2 says "ครบ 690 บาท รับ 1
// สิทธิ์" (once), the calculation note says "ทุกๆ 690 บาทต่อใบเสร็จ" (every).
// Until the marketing team says which, FLAT is the default: it is the reading
// in the conditions customers are shown, and giving fewer entries than promised
// is the error that gets corrected, not the one that gets argued about.
import { products } from "@/data/products";
import { brands, brandSlugAliases, slugifyVendor } from "@/data/brands";

export const GENERAL_THRESHOLD = 690;
export const KEYCHAIN_PRICE = 990;
export const KEYCHAIN_ENTRIES = 3;

/** true = "ทุกๆ 690 บาท" (multiplies), false = "ครบ 690 บาท" (once). Q1.2/1.3. */
export const TIERED = false;
/** true = keychain entries add to the amount entries. Q1.4. */
export const STACKS = true;

/**
 * The campaign runs on purchases made in this window, Bangkok time.
 *
 * Brought forward to 24 Sep on the shop's decision — the terms document still
 * says 28 Sep and has to be corrected to match, because VIP is decided by who
 * bought first and a start date nobody published is the kind of thing a
 * customer disputes at the announcement.
 */
export const OPENS_AT = Date.parse("2026-09-24T00:00:00+07:00");
export const CLOSES_AT = Date.parse("2026-10-26T23:59:59+07:00");

/** The same dates, written the way they are shown to customers. */
export const OPENS_LABEL = "24 ก.ย.";
export const CLOSES_LABEL = "26 ต.ค. 2569";

/**
 * The keychain sets, by product slug. Empty until marketing names them — and
 * empty is the safe state: it costs a customer the keychain bonus, which staff
 * can add by hand, rather than handing three entries to the wrong purchase.
 */
export const KEYCHAIN_SLUGS: string[] = [];

export type LineItem = { variantId: string; quantity: number; price: number };

/** Shopify vendor strings that mean Dentiste, slugified — "Dentiste'" included. */
const DENTISTE_SLUGS = (() => {
  const brand = brands.find((b) => b.slug === "dentiste");
  return new Set(brand ? brandSlugAliases(brand) : ["dentiste"]);
})();

/** variantId → the product it belongs to. Built once; the catalogue is static. */
const BY_VARIANT = (() => {
  const map = new Map<string, (typeof products)[number]>();
  for (const p of products) for (const v of p.variants) map.set(v.variantId, p);
  return map;
})();

export function isDentisteVariant(variantId: string): boolean {
  const p = BY_VARIANT.get(variantId);
  return p ? DENTISTE_SLUGS.has(slugifyVendor(p.brand)) : false;
}

function isKeychainVariant(variantId: string): boolean {
  const p = BY_VARIANT.get(variantId);
  return p ? KEYCHAIN_SLUGS.includes(p.slug) : false;
}

export type ReceiptAmounts = {
  /** What was paid for Dentiste products, keychain sets excluded. */
  dentisteAmount: number;
  /** What was paid for keychain sets. */
  keychainAmount: number;
  /** Line items we could not place in the catalogue — they count for nothing. */
  unknownVariants: string[];
};

/**
 * Splits an order's line items into what the campaign counts.
 *
 * Shipping never appears in line_items, so nothing has to be subtracted for it;
 * a discount is already reflected in the per-item price the customer was
 * charged, which is the "ยอดสุทธิ" the conditions ask for.
 */
export function amountsFromLineItems(lineItems: LineItem[] | null | undefined): ReceiptAmounts {
  const out: ReceiptAmounts = { dentisteAmount: 0, keychainAmount: 0, unknownVariants: [] };
  for (const li of lineItems ?? []) {
    const total = Number(li.price) * Number(li.quantity);
    if (!Number.isFinite(total) || total <= 0) continue;
    if (isKeychainVariant(li.variantId)) out.keychainAmount += total;
    else if (isDentisteVariant(li.variantId)) out.dentisteAmount += total;
    else if (!BY_VARIANT.has(li.variantId)) out.unknownVariants.push(li.variantId);
  }
  return out;
}

/** How many entries an order is worth. Never negative, never fractional. */
export function computeEntries({ dentisteAmount, keychainAmount }: Pick<ReceiptAmounts, "dentisteAmount" | "keychainAmount">): number {
  const general = TIERED
    ? Math.floor(dentisteAmount / GENERAL_THRESHOLD)
    : dentisteAmount >= GENERAL_THRESHOLD
      ? 1
      : 0;

  const keychain = TIERED
    ? Math.floor(keychainAmount / KEYCHAIN_PRICE) * KEYCHAIN_ENTRIES
    : keychainAmount >= KEYCHAIN_PRICE
      ? KEYCHAIN_ENTRIES
      : 0;

  return STACKS ? general + keychain : Math.max(general, keychain);
}

/** Whether a paid order is inside the campaign window at all. */
export function withinCampaign(confirmedAt: string | null | undefined, anyOrder = false): boolean {
  if (!confirmedAt) return false;
  if (anyOrder) return true;
  const t = Date.parse(confirmedAt);
  return Number.isFinite(t) && t >= OPENS_AT && t <= CLOSES_AT;
}

/**
 * `?test=1` — the form, working, before the campaign opens.
 *
 * It exists so the whole path can be walked once on real orders rather than
 * described: pick an order, upload, get the check back, watch it land in the
 * review queue. It only answers true before the campaign opens, so it expires
 * by itself on 28 Sep and there is no switch anybody has to remember to turn
 * off. Entries made this way carry TEST_MARKER so they can be told apart and
 * cleared out.
 */
export function isTestMode(value: string | null | undefined): boolean {
  return value === "1" && Date.now() < OPENS_AT;
}

export const TEST_MARKER = "TESTMODE";

/** 25 prizes per type; anyone drawn past that is a reserve, in the order called. */
export const PRIZES_PER_TYPE = 25;
/** Winners have until the end of this day to claim. */
export const CONFIRM_DEADLINE = "2026-11-05T23:59:59+07:00";

export type DrawnPlace = { rank: number; status: "pending_confirm" | "confirmed" | "forfeited" };

/**
 * Who actually holds a prize right now.
 *
 * Promotion is not a rewrite. Marking someone forfeited moves the next reserve
 * up by itself, because "winner" is the first twenty-five places that were not
 * given up — ranks keep the order they were drawn in, so the record of what
 * happened survives every change to who is holding what.
 */
export function holdsPrize<T extends DrawnPlace>(places: T[]): Set<T> {
  const live = [...places].sort((a, b) => a.rank - b.rank).filter((p) => p.status !== "forfeited");
  return new Set(live.slice(0, PRIZES_PER_TYPE));
}
