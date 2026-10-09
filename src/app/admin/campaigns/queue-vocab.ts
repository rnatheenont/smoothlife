// The vocabulary the queue is read in — shared by the list and the panel that
// opens over it, so a status can never mean two different things on one screen.
export type QueueItem = {
  id: string;
  status: "pending_review" | "approved" | "rejected" | "revoked";
  reviewedAt: string | null;
  rejectReason: string | null;
  revokeReason: string | null;
  customer: string | null;
  orderNumber: string | null;
  invoiceNo: string | null;
  /** Sent without a matching order — the entries are a reviewer's to decide. */
  manual?: boolean;
  /** The bill holds the VIP set, which earns no entries. */
  vip?: boolean;
  /** What that set cost — shown beside the ฿0 it counts for. */
  vipAmount?: number;
  paidAt: string | null;
  orderTotal: number | null;
  dentisteAmount: number;
  keychainAmount: number;
  entries: number;
  sentAt: string;
  photoUrl: string | null;
  aiCheck: {
    verdict: "ok" | "unclear" | "mismatch";
    message: string;
    findings: string[];
    /** What the photo was held up against. Absent on rows checked before this existed. */
    comparedAgainst?: "shop" | "customer" | "none";
  } | null;
  /** Shopify's own word on the order right now, not our 2C2P row. */
  paymentStatus: string | null;
  refunded: number;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  /** What the customer said their receipt shows — their words, not our record. */
  declared: { orderNumber: string | null; paidAt: string | null; total: number | null };
  /**
   * The shop's own record of the number on the claim, for entries with no
   * order of ours behind them. `belongsToCustomer` is null when there was
   * nothing to match on — not the same as "no".
   */
  claimedOrder:
    | { found: false; number: string }
    | {
        found: true;
        number: string;
        adminUrl: string;
        financialStatus: string | null;
        total: number;
        refunded: number;
        paidAt: string | null;
        ownerLabel: string | null;
        belongsToCustomer: boolean | null;
      }
    | null;
  /**
   * That customer's orders in the shop, found by the phone and email they
   * typed — only when the number on the claim found nothing.
   *
   * null = not looked up. ok:true with an empty list = asked, and the shop has
   * nothing under either contact. ok:false = the lookup failed and we know
   * nothing — which must never be drawn as "this person has no orders".
   */
  contactOrders: {
    ok: boolean;
    orders: {
      name: string;
      adminUrl: string;
      financialStatus: string | null;
      total: number;
      refunded: number;
      paidAt: string | null;
      customerLabel: string | null;
    }[];
  } | null;
  lines: { name: string; quantity: number; amount: number; kind: "dentiste" | "keychain" | "vip" | "other" }[];
};

export const LINE_KIND: Record<"dentiste" | "keychain" | "vip" | "other", [string, string]> = {
  dentiste: ["DENTISTE'", "bg-emerald-50 text-emerald-800"],
  keychain: ["Keychain", "bg-violet-50 text-violet-800"],
  vip: ["VIP · ไม่นับสิทธิ์", "bg-amber-50 text-amber-900"],
  other: ["ไม่นับ", "bg-slate-100 text-slate-500"],
};

/**
 * Shopify's financial statuses, in the reviewer's language and coloured by
 * what they mean for a claim: green is money we still have, amber is money we
 * are waiting on or have partly given back, rose is money that is gone.
 */
export const PAYMENT_STATUS: Record<string, [string, string]> = {
  PAID: ["ชำระแล้ว", "bg-emerald-50 text-emerald-800 border-emerald-200"],
  PARTIALLY_PAID: ["ชำระบางส่วน", "bg-amber-50 text-amber-900 border-amber-200"],
  PENDING: ["รอชำระเงิน", "bg-amber-50 text-amber-900 border-amber-200"],
  AUTHORIZED: ["กันวงเงินไว้ ยังไม่ตัด", "bg-amber-50 text-amber-900 border-amber-200"],
  PARTIALLY_REFUNDED: ["คืนเงินบางส่วน", "bg-amber-50 text-amber-900 border-amber-200"],
  REFUNDED: ["คืนเงินแล้ว", "bg-rose-50 text-rose-800 border-rose-200"],
  VOIDED: ["ยกเลิกรายการ", "bg-rose-50 text-rose-800 border-rose-200"],
  EXPIRED: ["หมดอายุ", "bg-rose-50 text-rose-800 border-rose-200"],
};
export const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const AI_LABEL: Record<"ok" | "unclear" | "mismatch", [string, string]> = {
  ok: ["ตรงกับคำสั่งซื้อ", "border-emerald-200 bg-emerald-50 text-emerald-800"],
  unclear: ["อ่านรูปไม่ชัด", "border-amber-200 bg-amber-50 text-amber-800"],
  mismatch: ["ไม่ตรงกับคำสั่งซื้อ", "border-rose-200 bg-rose-50 text-rose-800"],
} as const;

/**
 * The same three verdicts, worded for a check that had no order to check against.
 *
 * Green is reserved for a photo matched to the shop's own record. When the only
 * thing the photo agreed with is what the customer typed — numbers they copied
 * off that very photo — "ตรงกับคำสั่งซื้อ" in green reads as confirmation the
 * shop never gave, and it sat directly above an enabled อนุมัติ button.
 *
 * "unclear" reads the same either way: it is about the photo, not about what
 * the photo was compared with. The basis line in the panel carries that there.
 */
export const AI_LABEL_UNVERIFIED: Record<"ok" | "unclear" | "mismatch", [string, string]> = {
  ok: ["ตรงกับที่ลูกค้ากรอก", "border-amber-200 bg-amber-50 text-amber-900"],
  unclear: ["อ่านรูปไม่ชัด", "border-amber-200 bg-amber-50 text-amber-800"],
  mismatch: ["ไม่ตรงกับที่ลูกค้ากรอก", "border-rose-200 bg-rose-50 text-rose-800"],
} as const;

/** Which wording applies, defaulting old rows to the cautious one. */
export function aiLabelOf(check: NonNullable<QueueItem["aiCheck"]>): [string, string] {
  return check.comparedAgainst === "shop"
    ? AI_LABEL[check.verdict]
    : AI_LABEL_UNVERIFIED[check.verdict];
}

/** How a decided receipt ended up, for the list of the ones already decided. */
export const ENTRY_STATUS: Record<QueueItem["status"], [string, string]> = {
  pending_review: ["รอตรวจสอบ", "border-amber-200 bg-amber-50 text-amber-900"],
  approved: ["อนุมัติแล้ว", "border-emerald-200 bg-emerald-50 text-emerald-800"],
  rejected: ["ตีกลับ", "border-rose-200 bg-rose-50 text-rose-800"],
  revoked: ["ยกเลิกสิทธิ์ (คืนเงิน)", "border-slate-300 bg-slate-100 text-slate-700"],
};
