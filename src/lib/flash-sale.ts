// Server-side access to the flash-sale queue functions in Postgres
// (migration flash_sale_queue_system). All stock and queue decisions happen in
// those functions under a row lock; this file only calls them. Server only —
// supabaseRest uses the service role key.
import { supabaseRest } from "@/lib/supabase-server";

export type FlashSaleProductStatus = { slug: string; total: number; reserved: number; sold: number; waiting: number };
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
