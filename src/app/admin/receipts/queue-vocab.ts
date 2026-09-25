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
  paidAt: string | null;
  orderTotal: number | null;
  dentisteAmount: number;
  keychainAmount: number;
  entries: number;
  sentAt: string;
  photoUrl: string | null;
  aiCheck: { verdict: "ok" | "unclear" | "mismatch"; message: string; findings: string[] } | null;
  /** Shopify's own word on the order right now, not our 2C2P row. */
  paymentStatus: string | null;
  refunded: number;
  contactName: string | null;
  contactPhone: string | null;
  /** What the customer said their receipt shows — their words, not our record. */
  declared: { orderNumber: string | null; paidAt: string | null; total: number | null };
  lines: { name: string; quantity: number; amount: number; kind: "dentiste" | "keychain" | "other" }[];
};

export const LINE_KIND: Record<"dentiste" | "keychain" | "other", [string, string]> = {
  dentiste: ["DENTISTE'", "bg-emerald-50 text-emerald-800"],
  keychain: ["Keychain", "bg-violet-50 text-violet-800"],
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

/** How a decided receipt ended up, for the list of the ones already decided. */
export const ENTRY_STATUS: Record<QueueItem["status"], [string, string]> = {
  pending_review: ["รอตรวจสอบ", "border-amber-200 bg-amber-50 text-amber-900"],
  approved: ["อนุมัติแล้ว", "border-emerald-200 bg-emerald-50 text-emerald-800"],
  rejected: ["ตีกลับ", "border-rose-200 bg-rose-50 text-rose-800"],
  revoked: ["ยกเลิกสิทธิ์ (คืนเงิน)", "border-slate-300 bg-slate-100 text-slate-700"],
};
