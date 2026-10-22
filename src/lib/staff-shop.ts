import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { getProductDetail } from "@/data/product-details";
import {
  ITEM_COLUMNS,
  ORDER_COLUMNS,
  ROUND_COLUMNS,
  roundIsLive,
  type StaffOrder,
  type StaffRound,
  type StaffRoundItem,
  type StaffShopVariant,
} from "@/lib/staff-sale";

export type { StaffShopVariant };

// The employee shop's own reads. Server only.
//
// The one rule that shapes this file: a staff price leaves the server only
// to somebody who has verified a company mailbox for the round that price
// belongs to. So nothing here returns a price without being handed a
// verified user id, and the page itself is rendered from these calls rather
// than from the catalogue the browser already has.

/**
 * The round the shop is open for, or null.
 *
 * Both halves have to agree — the status column and the clock — because a
 * round left on `open` past its end date is shut, and the page must say so
 * rather than take an order the RPC will refuse.
 */
export async function currentStaffRound(): Promise<StaffRound | null> {
  const rows = await supabaseRest<StaffRound[]>(
    `staff_rounds?status=eq.open&select=${ROUND_COLUMNS}&order=starts_at.desc&limit=5`,
  ).catch(() => []);
  const now = new Date();
  return rows.find((r) => roundIsLive(r, now)) ?? null;
}

/** The next round that has not started, so a shut page can say when to come back. */
export async function upcomingStaffRound(): Promise<StaffRound | null> {
  const rows = await supabaseRest<StaffRound[]>(
    `staff_rounds?status=eq.open&starts_at=gt.${new Date().toISOString()}&select=${ROUND_COLUMNS}&order=starts_at.asc&limit=1`,
  ).catch(() => []);
  return rows?.[0] ?? null;
}

export type StaffStanding = {
  staff_email: string;
  cap_thb: number;
  reserved_thb: number;
  spent_thb: number;
  left_thb: number;
};

/**
 * Whether this account has proved a company mailbox for this round, and
 * what is left of its allowance.
 *
 * Read fresh on every request that returns prices — the console can revoke
 * an allowance or block an address between two clicks, and "they were
 * verified a minute ago" is not an answer the shop gets to give.
 */
export async function staffStanding(roundId: string, userId: string): Promise<StaffStanding | null> {
  const [verifications, entitlements] = await Promise.all([
    supabaseRest<{ staff_email_canonical: string }[]>(
      `staff_verifications?round_id=eq.${pgValue(roundId)}&user_id=eq.${pgValue(userId)}&select=staff_email_canonical&limit=1`,
    ).catch(() => []),
    supabaseRest<{ cap_thb: number; reserved_thb: number; spent_thb: number }[]>(
      `staff_entitlements?round_id=eq.${pgValue(roundId)}&user_id=eq.${pgValue(userId)}&select=cap_thb,reserved_thb,spent_thb&limit=1`,
    ).catch(() => []),
  ]);
  const v = verifications[0];
  const e = entitlements[0];
  if (!v || !e) return null;

  const cap = Number(e.cap_thb);
  const reserved = Number(e.reserved_thb);
  const spent = Number(e.spent_thb);

  // Blocked after verifying is the case the console warns about, and the
  // shop has to honour it between rounds of clicking rather than only at
  // the next verification.
  const blocked = await supabaseRest<{ id: string }[]>(
    `staff_eligibility?kind=eq.block_email&value=eq.${pgValue(v.staff_email_canonical)}&revoked_at=is.null&select=id&limit=1`,
  ).catch(() => []);
  if (blocked?.[0]) return null;

  return {
    staff_email: v.staff_email_canonical,
    cap_thb: cap,
    reserved_thb: reserved,
    spent_thb: spent,
    left_thb: Math.max(cap - reserved - spent, 0),
  };
}

/**
 * The price list, as the shop shows it.
 *
 * Joined against the server's full catalogue for the name, the picture and
 * the category — the price list stores a variant id and a slug, which is
 * the right thing to store and the wrong thing to show.
 */
export async function staffShopItems(roundId: string, userId: string): Promise<StaffShopVariant[]> {
  const [items, mine] = await Promise.all([
    supabaseRest<StaffRoundItem[]>(
      `staff_round_items?round_id=eq.${pgValue(roundId)}&enabled=is.true&select=${ITEM_COLUMNS}&limit=2000`,
    ).catch(() => []),
    supabaseRest<{ lines: { variant_id: string; qty: number }[] }[]>(
      `staff_orders?round_id=eq.${pgValue(roundId)}&user_id=eq.${pgValue(userId)}&status=in.(pending,paid)&select=lines&limit=200`,
    ).catch(() => []),
  ]);

  const held = new Map<string, number>();
  for (const o of mine) {
    for (const l of o.lines ?? []) {
      held.set(l.variant_id, (held.get(l.variant_id) ?? 0) + Number(l.qty));
    }
  }

  const out: StaffShopVariant[] = [];
  for (const i of items) {
    const product = getProductDetail(i.product_slug);
    const variant = product?.variants.find((v) => v.variantId === i.variant_id);
    // A line whose product has left the catalogue is left out rather than
    // shown as a blank card: the admin's own list still has it, and that is
    // where it should be noticed.
    if (!product) continue;
    const quota = i.total_quota == null ? null : Number(i.total_quota);
    out.push({
      variant_id: i.variant_id,
      product_slug: i.product_slug,
      name: product.name,
      brand: product.brand,
      category: product.category,
      image: variant?.image ?? product.image ?? null,
      size: variant?.size ?? "",
      regular_price: Number(i.regular_price),
      staff_price: Number(i.staff_price),
      per_person_limit: i.per_person_limit == null ? null : Number(i.per_person_limit),
      left: quota === null ? null : Math.max(quota - Number(i.sold_qty) - Number(i.reserved_qty), 0),
      mine: held.get(i.variant_id) ?? 0,
    });
  }
  return out;
}

/** The one order this person may have waiting for payment in this round. */
export async function staffPendingOrder(roundId: string, userId: string): Promise<StaffOrder | null> {
  const rows = await supabaseRest<StaffOrder[]>(
    `staff_orders?round_id=eq.${pgValue(roundId)}&user_id=eq.${pgValue(userId)}&status=eq.pending&select=${ORDER_COLUMNS}&limit=1`,
  ).catch(() => []);
  const order = rows?.[0];
  return order ? { ...order, subtotal_thb: Number(order.subtotal_thb) } : null;
}

/** Everything this person has bought in this round, for the profile page. */
export async function staffOrdersFor(userId: string, limit = 50): Promise<StaffOrder[]> {
  const rows = await supabaseRest<StaffOrder[]>(
    `staff_orders?user_id=eq.${pgValue(userId)}&select=${ORDER_COLUMNS}&order=created_at.desc&limit=${limit}`,
  ).catch(() => []);
  return rows.map((o) => ({ ...o, subtotal_thb: Number(o.subtotal_thb) }));
}

export type StaffAddress = {
  firstName?: string;
  lastName?: string;
  address1: string;
  city: string;
  province?: string;
  zip: string;
  countryCode: string;
  phone?: string;
};

type AddressRow = {
  recipient_name: string | null;
  phone: string | null;
  address_line: string;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  is_default: boolean;
};

/**
 * The address the order ships to, from the ones the account already has.
 *
 * Not asked for again on /staff. An employee buying at cost through the
 * shop they work for has an address on file from buying at retail, and a
 * second address form is a second place for it to go stale.
 */
export async function staffShippingAddress(userId: string): Promise<StaffAddress | null> {
  const rows = await supabaseRest<AddressRow[]>(
    `addresses?user_id=eq.${pgValue(userId)}&select=recipient_name,phone,address_line,subdistrict,district,province,postal_code,country,is_default&order=is_default.desc,updated_at.desc&limit=1`,
  ).catch(() => []);
  const a = rows?.[0];
  if (!a || !a.address_line || !a.postal_code) return null;

  const [firstName, ...rest] = (a.recipient_name ?? "").trim().split(/\s+/);
  // Subdistrict and district belong in the street lines on a Thai address —
  // Shopify has one city field, and province is its own code. See the note
  // at the top of shopify-th-address.ts.
  const street = [a.address_line, a.subdistrict].filter(Boolean).join(" ");
  return {
    firstName: firstName || undefined,
    lastName: rest.join(" ") || undefined,
    address1: street,
    city: a.district ?? a.province ?? "",
    province: a.province ?? undefined,
    zip: a.postal_code,
    countryCode: a.country || "TH",
    phone: a.phone ?? undefined,
  };
}

/** `STF` plus the invoice's own randomness — 2C2P's invoiceNo must be unique. */
export function staffInvoiceNo(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `STF${stamp}${rand}`;
}
