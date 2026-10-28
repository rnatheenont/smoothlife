// The staff sale, from the server's side: types, the RPC calls, and the Thai
// the shop and the console both have to say.
//
// Deliberately free of any database import, so the admin console and the
// /staff pages can share the types and the Thai without dragging
// supabase-server — and with it the service-role key path — into a browser
// bundle. The calls themselves live in ./staff-sale-rpc, which is server
// only. check-client-bundle is what notices if that ever stops being true.

/**
 * One buyable line as the /staff page shows it: the price list's row joined
 * to the catalogue's name, picture and category.
 *
 * Declared here, with the other shared types, rather than beside the query
 * that builds it — the page is a client component, and a type imported from
 * a module that reaches the database is one `import type` away from pulling
 * supabase-server into a browser bundle.
 */
export type StaffShopVariant = {
  variant_id: string;
  product_slug: string;
  name: string;
  brand: string;
  category: string;
  image: string | null;
  size: string;
  regular_price: number;
  staff_price: number;
  per_person_limit: number | null;
  /**
   * How many may still be taken: the round's own quota and what Shopify has
   * on the shelf, whichever is smaller. Null only when neither is limited.
   */
  left: number | null;
  /** How many of this line the person already holds, paid or awaiting payment. */
  mine: number;
  /** False when Shopify has none of this variant left. */
  in_stock: boolean;
};

/**
 * How long a mailbox stays proved.
 *
 * Signing in with the company address lets somebody into the shop without a
 * code — but only for this long after they last read one out of that
 * mailbox. Past it they are asked once and the clock restarts.
 *
 * The number is the leaver check: the once-a-round code existed because
 * somebody who has left cannot open the company mailbox any more, and a
 * shortcut with no expiry hands that person a permanent way in on a
 * password alone. 30 days, chosen by TOP on 22 Oct 2026.
 */
export const MAILBOX_PROOF_DAYS = 30;

export type RoundStatus = "draft" | "open" | "closed";

export type StaffRound = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  cap_thb: number;
  status: RoundStatus;
  payment_window_min: number;
  /**
   * The round's blanket per-person limit per item — "nobody takes more than
   * six of any one thing". Null means no blanket limit.
   *
   * A row in the price list may still be stricter; the RPC takes whichever
   * bites first. It lives on the round rather than on every row because it
   * is a rule, and a rule typed once per product is a rule that holds only
   * where somebody remembered to type it.
   */
  max_per_item: number | null;
  /**
   * How many times one person may buy in this round. One, by default — the
   * allowance is a round's worth of shopping rather than a balance to draw
   * down over a fortnight, and one order is one parcel to pack. Null means
   * no limit.
   */
  max_orders: number | null;
  created_at: string;
};

export const ROUND_COLUMNS =
  "id,name,starts_at,ends_at,cap_thb,status,payment_window_min,max_per_item,max_orders,created_at";

export type StaffRoundItem = {
  id: string;
  round_id: string;
  variant_id: string;
  product_slug: string;
  collection_handle: string | null;
  regular_price: number;
  /** RP before the 10% markup. Null means nobody has typed one — see rpOf. */
  rp_price: number | null;
  staff_price: number;
  per_person_limit: number | null;
  total_quota: number | null;
  sold_qty: number;
  reserved_qty: number;
  enabled: boolean;
};

export const ITEM_COLUMNS =
  "id,round_id,variant_id,product_slug,collection_handle,regular_price,rp_price,staff_price," +
  "per_person_limit,total_quota,sold_qty,reserved_qty,enabled";

/** The markup sitting on top of RP in the catalogue price. */
export const RP_MARKUP = 1.1;

/**
 * The RP a staff price is worked out from.
 *
 * The catalogue price is the RP with 10% on it, so the RP is that divided by
 * 1.1 — 418 is 380, 583 is 530. Checked against the round's own 387 rows
 * before this was written: dividing lands on a whole baht almost three times
 * as often as taking 10% off does, which is what you would expect if the
 * markup is what put the number there.
 *
 * It is only ever a starting figure. The moment an admin types an RP, that
 * is the RP, and this stops guessing for that row.
 */
export function rpOf(item: { regular_price: number | string; rp_price?: number | string | null }): number {
  const typed = item.rp_price == null || item.rp_price === "" ? null : Number(item.rp_price);
  if (typed !== null && Number.isFinite(typed) && typed > 0) return typed;
  return Math.round((Number(item.regular_price) / RP_MARKUP) * 100) / 100;
}

export type EligibilityKind = "allow_domain" | "allow_email" | "block_email";

export type StaffEligibility = {
  id: string;
  kind: EligibilityKind;
  value: string;
  reason: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export const ELIGIBILITY_COLUMNS =
  "id,kind,value,reason,expires_at,revoked_at,created_at";

export type StaffOrderStatus = "pending" | "paid" | "expired" | "cancelled" | "refunded";

export type StaffOrderLine = {
  variant_id: string;
  product_slug: string;
  qty: number;
  staff_price: number;
  regular_price: number;
};

export type StaffOrder = {
  id: string;
  round_id: string;
  user_id: string;
  staff_email: string;
  status: StaffOrderStatus;
  lines: StaffOrderLine[];
  subtotal_thb: number;
  expires_at: string;
  payment_reference: string | null;
  /** 2C2P's own payment page, kept so an abandoned payment can be finished. */
  payment_url: string | null;
  shopify_order_id: string | null;
  shopify_sync_status: "pending" | "synced" | "failed";
  needs_refund: boolean;
  note: string | null;
  created_at: string;
  paid_at: string | null;
};

export const ORDER_COLUMNS =
  "id,round_id,user_id,staff_email,status,lines,subtotal_thb,expires_at," +
  "payment_reference,payment_url,shopify_order_id,shopify_sync_status,needs_refund,note,created_at,paid_at";

/**
 * The same canonicalisation the database does, in TypeScript.
 *
 * Here so a form can show the address it is really about to save before it
 * saves it — `Somchai+promo@SMOOTH-E.com` is going in as
 * `somchai@smooth-e.com`, and an admin adding an exception should see that.
 * `staff_canon_email` in Postgres remains the one that decides.
 */
export function canonStaffEmail(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const local = trimmed.slice(0, at).split("+")[0].toLowerCase();
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!local || !domain.includes(".")) return null;
  return `${local}@${domain}`;
}

/** A bare domain, for the allow list. No @, at least one dot. */
export function canonStaffDomain(value: string): string | null {
  const d = value.trim().toLowerCase().replace(/^@/, "");
  if (!d || d.includes("@") || !d.includes(".") || /\s/.test(d)) return null;
  return d;
}

/**
 * Every reason the RPCs can refuse, in the words the person reads.
 *
 * One map for the console and the shop, because the two must not drift into
 * explaining the same refusal differently. The shop is deliberately vague
 * about eligibility: telling somebody *why* they are not eligible tells them
 * whether they are on a blocklist, which is not theirs to know.
 */
export const STAFF_REASON_TH: Record<string, string> = {
  invalid_email: "อีเมลไม่ถูกต้อง",
  round_closed: "รอบการซื้อนี้ปิดแล้ว",
  not_eligible: "อีเมลนี้ยังไม่มีสิทธิ์ซื้อในรอบนี้",
  email_or_account_taken: "อีเมลนี้ถูกใช้ยืนยันกับอีกบัญชีในรอบนี้แล้ว",
  not_verified: "ยังไม่ได้ยืนยันอีเมลพนักงานสำหรับรอบนี้",
  empty_cart: "ยังไม่ได้เลือกสินค้า",
  duplicate_lines: "มีสินค้าซ้ำกันในตะกร้า",
  bad_qty: "จำนวนไม่ถูกต้อง",
  item_unavailable: "สินค้านี้ไม่ได้อยู่ในรอบนี้แล้ว",
  per_person_limit: "เกินจำนวนที่ซื้อได้ต่อคนสำหรับสินค้านี้",
  sold_out: "สินค้านี้หมดแล้ว",
  over_cap: "เกินวงเงินที่เหลือของคุณ",
  pending_order_exists: "คุณมีคำสั่งซื้อที่รอชำระเงินอยู่แล้ว",
  order_limit_reached: "รอบนี้ซื้อได้ครั้งเดียว และคุณใช้สิทธิ์ไปแล้ว",
  unknown_reference: "ไม่พบรายการชำระเงินนี้",
  bad_status: "สถานะคำสั่งซื้อไม่ถูกต้อง",
  amount_mismatch: "ยอดชำระไม่ตรงกับคำสั่งซื้อ",
  late_needs_refund: "ชำระเงินหลังหมดเวลาและสิทธิ์ไม่เหลือ — ต้องคืนเงิน",
  not_found: "ไม่พบคำสั่งซื้อนี้",
  not_pending: "คำสั่งซื้อนี้ไม่ได้รออยู่",
  not_paid: "คำสั่งซื้อนี้ยังไม่ได้ชำระเงิน",
};

export function reasonTh(reason: string | null | undefined): string {
  if (!reason) return "ไม่สำเร็จ";
  return STAFF_REASON_TH[reason] ?? reason;
}

/**
 * What the round is doing right now, as opposed to what its status column
 * says. A round left on `open` past its end date is closed to a shopper, and
 * the console has to show that rather than the stale word.
 */
export function roundPhase(round: StaffRound, now = new Date()): "draft" | "upcoming" | "live" | "ended" | "closed" {
  if (round.status === "draft") return "draft";
  if (round.status === "closed") return "closed";
  if (now < new Date(round.starts_at)) return "upcoming";
  if (now > new Date(round.ends_at)) return "ended";
  return "live";
}

export const PHASE_TH: Record<ReturnType<typeof roundPhase>, string> = {
  draft: "ร่าง",
  upcoming: "รอเปิด",
  live: "เปิดขายอยู่",
  ended: "หมดเวลา",
  closed: "ปิดแล้ว",
};

/** A round is sellable only when both the status and the clock agree. */
export function roundIsLive(round: StaffRound, now = new Date()) {
  return roundPhase(round, now) === "live";
}

export type RoundInput = {
  name: string;
  starts_at: string;
  ends_at: string;
  cap_thb: number;
  payment_window_min: number;
  max_per_item: number | null;
  max_orders: number | null;
};

/**
 * The form's values, checked here rather than trusted.
 *
 * The database has the same constraints — this exists so the console can say
 * which field is wrong in Thai instead of surfacing a constraint name.
 */
export function parseRoundInput(body: unknown): { input: RoundInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "ข้อมูลไม่ถูกต้อง" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 2) return { error: "กรุณาตั้งชื่อรอบการซื้อ" };
  if (name.length > 120) return { error: "ชื่อรอบยาวเกินไป" };

  const starts = typeof b.starts_at === "string" ? new Date(b.starts_at) : null;
  const ends = typeof b.ends_at === "string" ? new Date(b.ends_at) : null;
  if (!starts || Number.isNaN(starts.getTime())) return { error: "วันเวลาเริ่มไม่ถูกต้อง" };
  if (!ends || Number.isNaN(ends.getTime())) return { error: "วันเวลาสิ้นสุดไม่ถูกต้อง" };
  if (ends <= starts) return { error: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม" };

  const cap = Number(b.cap_thb);
  if (!Number.isFinite(cap) || cap <= 0) return { error: "วงเงินต่อคนต้องมากกว่า 0" };
  if (cap > 1_000_000) return { error: "วงเงินต่อคนสูงเกินไป" };

  const win = Number(b.payment_window_min ?? 30);
  if (!Number.isInteger(win) || win < 5 || win > 180) {
    return { error: "เวลาที่ให้ชำระเงินต้องอยู่ระหว่าง 5–180 นาที" };
  }

  const rawMax = b.max_per_item;
  const max = rawMax == null || rawMax === "" ? null : Number(rawMax);
  if (max !== null && (!Number.isInteger(max) || max < 1 || max > 999)) {
    return { error: "จำนวนสูงสุดต่อสินค้าต้องเป็นจำนวนเต็ม 1–999 (เว้นว่าง = ไม่จำกัด)" };
  }

  const rawOrders = b.max_orders;
  const orders = rawOrders == null || rawOrders === "" ? null : Number(rawOrders);
  if (orders !== null && (!Number.isInteger(orders) || orders < 1 || orders > 99)) {
    return { error: "จำนวนครั้งที่ซื้อได้ต่อรอบต้องเป็นจำนวนเต็ม 1–99 (เว้นว่าง = ไม่จำกัด)" };
  }

  return {
    input: {
      name,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      cap_thb: Math.round(cap * 100) / 100,
      payment_window_min: win,
      max_per_item: max,
      max_orders: orders,
    },
  };
}

export type ItemInput = {
  variant_id: string;
  product_slug: string;
  collection_handle: string | null;
  regular_price: number;
  rp_price: number | null;
  staff_price: number;
  per_person_limit: number | null;
  total_quota: number | null;
  enabled: boolean;
};

/**
 * One row of the price list.
 *
 * A staff price at or above the regular price is refused rather than
 * warned about: the whole page exists to sell below retail, and a row that
 * does not is a typo every time. Zero is refused by the database as well.
 */
/**
 * The most of any one product a member of staff may take in a round.
 *
 * A shop rule, not a per-row preference, so it lives here rather than in the
 * form: the console writes this number into every row, and a row edited by
 * hand afterwards is checked against it too. Six is what the shop sells at
 * cost without it turning into a side business.
 */
export const MAX_PER_PERSON = 6;

export function parseItemInput(body: unknown): { input: ItemInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "ข้อมูลไม่ถูกต้อง" };
  const b = body as Record<string, unknown>;

  const variant_id = typeof b.variant_id === "string" ? b.variant_id.trim() : "";
  const product_slug = typeof b.product_slug === "string" ? b.product_slug.trim() : "";
  if (!variant_id || !product_slug) return { error: "ไม่พบสินค้าหรือตัวเลือกสินค้า" };

  const regular = Number(b.regular_price);
  const staff = Number(b.staff_price);
  if (!Number.isFinite(regular) || regular < 0) return { error: "ราคาปกติไม่ถูกต้อง" };
  if (!Number.isFinite(staff) || staff <= 0) return { error: "ราคาพนักงานต้องมากกว่า 0" };

  const rpRaw = b.rp_price == null || b.rp_price === "" ? null : Number(b.rp_price);
  if (rpRaw !== null && (!Number.isFinite(rpRaw) || rpRaw <= 0)) {
    return { error: "ราคา RP ต้องมากกว่า 0" };
  }
  if (rpRaw !== null && regular > 0 && rpRaw > regular) {
    // RP is the price before the markup, so it cannot be above the price
    // that carries it. Usually a digit typed twice.
    return { error: "ราคา RP ต้องไม่สูงกว่าราคา RP +10%" };
  }
  const rp = rpOf({ regular_price: regular, rp_price: rpRaw });
  // Measured against RP now, because that is what the discount comes off.
  if (staff >= rp && rp > 0) {
    return { error: "ราคาพนักงานต้องต่ำกว่าราคา RP" };
  }

  const limit = b.per_person_limit == null || b.per_person_limit === "" ? null : Number(b.per_person_limit);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    return { error: "จำนวนจำกัดต่อคนต้องเป็นจำนวนเต็มตั้งแต่ 1" };
  }
  // Checked here rather than only in the form, because the form is not the
  // only way a row is written: the bulk setter, a copied round and a direct
  // PATCH all come through here.
  if (limit !== null && limit > MAX_PER_PERSON) {
    return { error: `จำนวนจำกัดต่อคนต้องไม่เกิน ${MAX_PER_PERSON} ชิ้น` };
  }
  const quota = b.total_quota == null || b.total_quota === "" ? null : Number(b.total_quota);
  if (quota !== null && (!Number.isInteger(quota) || quota < 1)) {
    return { error: "โควตารวมต้องเป็นจำนวนเต็มตั้งแต่ 1" };
  }

  return {
    input: {
      variant_id,
      product_slug,
      collection_handle:
        typeof b.collection_handle === "string" && b.collection_handle ? b.collection_handle : null,
      regular_price: Math.round(regular * 100) / 100,
      rp_price: rpRaw === null ? null : Math.round(rpRaw * 100) / 100,
      staff_price: Math.round(staff * 100) / 100,
      per_person_limit: limit,
      total_quota: quota,
      enabled: b.enabled !== false,
    },
  };
}

/**
 * "Everything at 40% off", rounded the way a price list is read.
 *
 * Rounding down to the baht and then to the nearest 5 or 10 is what the
 * team does by hand — 590 at 40% is 354, which nobody prints; 350 is.
 */
export type StaffRoundTo = 0 | 1 | 5 | 10;

export function discountedPrice(regular: number, percent: number, roundTo: StaffRoundTo): number {
  const raw = regular * (1 - percent / 100);
  if (raw <= 0) return 0;
  // 0 means leave it alone, so the discount is exactly the one that was
  // asked for. Rounding to the nearest 5 turns "60% off" into anything from
  // 60% to 64% depending on the price, which is how one round ended up
  // showing -60%, -63% and -62% side by side on the same screen.
  // Two decimals only to keep binary floating point from writing 37.600000000000001.
  if (roundTo === 0) return Math.round(raw * 100) / 100;
  const floored = Math.floor(raw / roundTo) * roundTo;
  // Never round a price down to nothing: a 10-baht sachet at 90% off is 1.
  return floored > 0 ? floored : Math.max(1, Math.floor(raw));
}
