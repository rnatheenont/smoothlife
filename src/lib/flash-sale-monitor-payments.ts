// The money half of the live monitor.
//
// The console could say how many people were in the queue and who was holding a
// slot, and nothing at all about what happened when they pressed ชำระเงิน. On
// the day that mattered the answers — 141 people reached their turn, 17 pressed
// pay, none finished, and 97 of the 141 had no saved address, which is what the
// button was waiting for — all had to be written as SQL by hand while the sale
// was running. They belong on the page.
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { flashSalePaymentStats, type FlashSalePaymentStats } from "@/lib/flash-sale";
import { variantOrdersSince, type VariantOrder } from "@/lib/shopify-admin";

/** One press of ชำระเงิน and what became of it. */
export type PaymentAttempt = {
  invoice_no: string;
  amount: number;
  status: "pending" | "success" | "failed" | string;
  via: "shopify" | "2c2p";
  /** Shopify's own order name once there is one. */
  order: string | null;
  note: string | null;
  refund_note: string | null;
  created_at: string;
  confirmed_at: string | null;
  /** Queue position, so a row here can be found in the queue above it. */
  position: number | null;
};

export type MonitorPayments = {
  stats: FlashSalePaymentStats;
  attempts: PaymentAttempt[];
  /**
   * Paid Shopify orders for this campaign's products since it opened, whether
   * or not they came through the queue. The two that went out of the shop's own
   * front door on opening day were invisible here while "ขาย 2" sat two lines
   * above "จ่ายสำเร็จ 0".
   */
  orders: VariantOrder[];
};

const ATTEMPT_LIMIT = 40;

type Row = {
  invoice_no: string;
  amount: number | string;
  status: string;
  shopify_cart_id: string | null;
  shopify_order_id: string | null;
  tran_ref: string | null;
  resp_desc: string | null;
  refund_note: string | null;
  created_at: string;
  confirmed_at: string | null;
  flash_sale_queue: { position: number | null } | { position: number | null }[] | null;
};

function positionOf(row: Row): number | null {
  const q = row.flash_sale_queue;
  if (!q) return null;
  return Array.isArray(q) ? (q[0]?.position ?? null) : q.position;
}

/** The shop's own paid orders for whatever this campaign sells. */
async function shopOrdersFor(campaignId: string, startsAt: string): Promise<VariantOrder[]> {
  const sales = await supabaseRest<{ variant_id: string | null }[]>(
    `flash_sales?campaign_id=eq.${pgValue(campaignId)}&select=variant_id`
  ).catch(() => []);
  return variantOrdersSince(sales.map((r) => r.variant_id), startsAt);
}

/** Never throws: the queue is the point of this page, and this is the sidebar. */
export async function monitorPayments(campaignId: string, startsAt?: string): Promise<MonitorPayments | null> {
  try {
    const [stats, rows, orders] = await Promise.all([
      flashSalePaymentStats(campaignId),
      supabaseRest<Row[]>(
        `payment_transactions?select=invoice_no,amount,status,shopify_cart_id,shopify_order_id,tran_ref,resp_desc,refund_note,created_at,confirmed_at,flash_sale_queue!inner(campaign_id,position)` +
          `&flash_sale_queue.campaign_id=eq.${pgValue(campaignId)}&order=created_at.desc&limit=${ATTEMPT_LIMIT}`
      ),
      startsAt ? shopOrdersFor(campaignId, startsAt) : Promise.resolve([]),
    ]);
    if (!stats) return null;
    return {
      stats,
      orders,
      attempts: rows.map((r) => ({
        invoice_no: r.invoice_no,
        amount: Number(r.amount),
        status: r.status,
        via: r.shopify_cart_id ? "shopify" : "2c2p",
        order: r.shopify_order_id ?? r.tran_ref,
        note: r.resp_desc,
        refund_note: r.refund_note,
        created_at: r.created_at,
        confirmed_at: r.confirmed_at,
        position: positionOf(r),
      })),
    };
  } catch (err) {
    console.error("[admin/flash-sale] payment stats failed", err);
    return null;
  }
}
