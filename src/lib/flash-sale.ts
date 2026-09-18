// Server-side access to the flash-sale queue functions in Postgres
// (migration flash_sale_queue_system). All stock and queue decisions happen in
// those functions under a row lock; this file only calls them. Server only —
// supabaseRest uses the service role key.
import { supabaseRest } from "@/lib/supabase-server";

export type FlashSaleProductStatus = { slug: string; total: number; reserved: number; sold: number; waiting: number; sale_price: number | null };
export type FlashSaleMe = {
  id: string;
  product_slug: string;
  status: "waiting" | "reserved" | "paid" | "expired" | "left" | "closed";
  position: number;
  ahead: number | null;
  seconds_left: number | null;
  payment_reference: string | null;
  shopify_order_id: string | null;
  expired_count: number;
  /** A 2C2P payment page has been opened for this reservation. */
  payment_pending?: boolean;
};
export type FlashSaleStatus = {
  campaign: {
    id: string;
    title: string;
    phase: "scheduled" | "open" | "ended";
    starts_at: string;
    ends_at: string | null;
    window_minutes: number;
    max_requeue: number;
  };
  server_now: string;
  products: FlashSaleProductStatus[];
  me: FlashSaleMe | null;
};
export type FlashSaleMonitor = FlashSaleStatus & {
  reserved: { position: number; product_slug: string; name: string; requeue_count: number; seconds_left: number }[];
  recent: { at: string; status: FlashSaleMe["status"]; position: number; product_slug: string; name: string; sync: string | null }[];
  totals: { customers: number; expired: number; requeues: number; sync_failed: number };
};

export type JoinError = "not_found" | "not_open" | "ended" | "sold_out" | "already_in_queue" | "requeue_limit";

export const JOIN_ERROR_TH: Record<JoinError, string> = {
  not_found: "ไม่พบสินค้านี้ในแคมเปญ",
  not_open: "ยังไม่ถึงเวลาเปิดขาย",
  ended: "ปิดการขายแล้ว",
  sold_out: "สินค้าหมดแล้ว",
  already_in_queue: "คุณมีคิวหรือสิทธิ์ในแคมเปญนี้อยู่แล้ว (1 บัญชีซื้อได้ 1 ชิ้นต่อแคมเปญ)",
  requeue_limit: "ใช้สิทธิ์กลับเข้าคิวครบแล้วสำหรับแคมเปญนี้",
};

const rpc = <T>(fn: string, args: Record<string, unknown>) =>
  supabaseRest<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function flashSaleStatus(campaignId: string, userId: string | null) {
  return rpc<FlashSaleStatus | null>("fs_status", { p_campaign: campaignId, p_user: userId });
}

export function flashSaleMonitor(campaignId: string) {
  return rpc<FlashSaleMonitor | null>("fs_admin_monitor", { p_campaign: campaignId });
}

export function joinFlashSale(campaignId: string, productSlug: string, userId: string) {
  return rpc<{ ok: true; entry_id: string } | { ok: false; error: JoinError }>("fs_join", {
    p_campaign: campaignId,
    p_product: productSlug,
    p_user: userId,
  });
}

export function leaveFlashSale(campaignId: string, userId: string) {
  return rpc<{ ok: boolean }>("fs_leave", { p_campaign: campaignId, p_user: userId });
}

export function createFlashSaleCampaign(payload: Record<string, unknown>) {
  return rpc<string>("fs_create_campaign", { p: payload });
}

/** Edit a stored campaign; the function decides how much of it may still change. */
export function updateFlashSaleCampaign(payload: Record<string, unknown>) {
  return rpc<{ ok: true; scope: "full" | "limited" } | { ok: false; error: "not_found" | "bad_end" }>("fs_update_campaign", { p: payload });
}

export function startFlashSalePayment(campaignId: string, userId: string) {
  return rpc<
    | { ok: true; entry_id: string; product_slug: string; variant_id: string | null; sale_price: number | string | null; expires_at: string }
    | { ok: false; error: "no_reservation" | "too_late" }
  >("fs_start_payment", { p_campaign: campaignId, p_user: userId });
}

/** Webhook only: entry id when the reservation became paid, null when too late or a repeat. */
export function confirmFlashSalePayment(entryId: string, reference: string) {
  return rpc<string | null>("fs_confirm_payment", { p_entry: entryId, p_reference: reference });
}

/** Marker in payment_transactions.refund_note for a charge that arrived after its reservation was gone. */
export const LATE_PAYMENT_NOTE = "FLASH_SALE_LATE: เงินเข้าแต่ไม่มีสิทธิ์จองที่ยังใช้ได้ (หมดเวลาหรือชำระซ้ำ) ต้องคืนเงินลูกค้า";
