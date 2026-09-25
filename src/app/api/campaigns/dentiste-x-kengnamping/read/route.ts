import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isRateLimitedShared } from "@/lib/rate-limit";
import { ipLimited, TOO_MANY_TH } from "@/lib/abuse-guard";
import { checkReceiptPhoto } from "@/lib/receipt-vision";
import { receiptExtension, MAX_RECEIPT_BYTES } from "@/lib/receipt-photos";
import { amountsFromLineItems, computeEntries, withinCampaign } from "@/lib/receipt-campaign";
import { loadCampaignContent, windowOf } from "@/lib/receipt-campaign-content";
import { orderNamesByGid } from "@/lib/shopify-admin";

// Reading a receipt before it is sent, so the form arrives filled in.
//
// Nothing is stored here and no claim is made: this takes a picture, says what
// it can make out, and hands it back for the customer to correct. The entries
// an order is worth are still computed from the order row on submit — what is
// typed in these boxes is a customer's account of their own receipt, which is
// exactly what a reviewer wants beside the photo, and exactly what must never
// be allowed to decide a prize.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPAIGN = "dentiste-x-kengnamping";

type TxRow = {
  id: string;
  invoice_no: string;
  amount: number;
  confirmed_at: string | null;
  line_items: { variantId: string; quantity: number; price: number }[] | null;
  shopify_order_id: string | null;
};

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  // Reading costs a model call; a person does it a handful of times.
  if (await isRateLimitedShared(`receipt-read:${uid}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "ตรวจรูปบ่อยเกินไป กรุณาลองใหม่ในอีกสักครู่" }, { status: 429 });
  }
  // Per address as well as per account: every call here is a model call we pay
  // for, and an account is the cheapest thing in this system to make more of.
  if (await ipLimited(req, "receipt-read", 60, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: TOO_MANY_TH }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  const orderId = typeof form?.get("orderId") === "string" ? (form.get("orderId") as string) : "";
  if (!(photo instanceof File)) {
    return NextResponse.json({ ok: false, error: "กรุณาแนบรูปใบเสร็จ" }, { status: 400 });
  }
  if (photo.size > MAX_RECEIPT_BYTES) {
    return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกินไป (ไม่เกิน 8MB)" }, { status: 400 });
  }
  if (!receiptExtension(photo.type)) {
    return NextResponse.json({ ok: false, error: "รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP" }, { status: 400 });
  }

  const content = await loadCampaignContent(CAMPAIGN);
  const window = windowOf(content);

  const rows = await supabaseRest<TxRow[]>(
    `payment_transactions?user_id=eq.${pgValue(uid)}&status=eq.success` +
      `&select=id,invoice_no,amount,confirmed_at,line_items,shopify_order_id&order=confirmed_at.desc&limit=100`
  ).catch(() => [] as TxRow[]);
  const orders = rows.filter(
    (tx) => withinCampaign(tx.confirmed_at, false, window) && amountsFromLineItems(tx.line_items).dentisteAmount > 0
  );
  const order = orders.find((o) => o.id === orderId) ?? orders[0] ?? null;

  const names = order ? await orderNamesByGid([order.shopify_order_id]) : new Map<string, string>();
  const amounts = order ? amountsFromLineItems(order.line_items) : null;

  const check = await checkReceiptPhoto({
    bytes: await photo.arrayBuffer(),
    contentType: photo.type,
    order: {
      orderNumber: order ? (names.get(order.shopify_order_id ?? "") ?? null) : null,
      invoiceNo: order?.invoice_no ?? null,
      total: order ? Number(order.amount) : 0,
      paidAt: order?.confirmed_at ?? null,
      items: (order?.line_items ?? []).map((li) => `variant ${li.variantId} x${li.quantity}`),
    },
  });

  return NextResponse.json({
    ok: true,
    aiCheck: check,
    // What the photo said, and what the order says. The form shows the first
    // and submits against the second; where they disagree the customer is the
    // one who can see both.
    read: check?.read ?? { orderNumber: null, total: null, paidAt: null },
    order: order
      ? {
          id: order.id,
          orderNumber: names.get(order.shopify_order_id ?? "") ?? null,
          invoiceNo: order.invoice_no,
          paidAt: order.confirmed_at,
          total: Number(order.amount),
          dentisteAmount: amounts?.dentisteAmount ?? 0,
          entries: amounts ? computeEntries(amounts) : 0,
        }
      : null,
  });
}
