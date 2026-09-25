import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isRateLimitedShared } from "@/lib/rate-limit";
import { ipLimited, TOO_MANY_TH } from "@/lib/abuse-guard";
import { checkReceiptPhoto } from "@/lib/receipt-vision";
import { receiptExtension, MAX_RECEIPT_BYTES } from "@/lib/receipt-photos";
import { amountsFromLineItems, computeEntries } from "@/lib/receipt-campaign";
import { loadCampaignContent } from "@/lib/receipt-campaign-content";
import { orderNamesByGid } from "@/lib/shopify-admin";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";
import { eligibleOrders, type CampaignOrder } from "@/lib/receipt-campaign-orders";

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



type TxRow = {
  id: string;
  invoice_no: string;
  amount: number;
  confirmed_at: string | null;
  line_items: { variantId: string; quantity: number; price: number }[] | null;
  shopify_order_id: string | null;
};

export async function POST(req: NextRequest, props: { params: Promise<{ campaign: string }> }) {
  const CAMPAIGN = campaignKeyFrom((await props.params).campaign);
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
  const { orders } = await eligibleOrders(CAMPAIGN, uid);
  // Which order this photo is compared against, and never a guess.
  //
  // It used to fall back to orders[0] — the customer's newest — so a ฿1,600
  // receipt for #4305 was handed to the model as if it were #4292 and came
  // back "ไม่ตรง". That is a verdict about a comparison nobody asked for, and
  // it is the number printed on the photo that decides which order this is.
  const names = await orderNamesByGid(orders.map((o) => o.shopify_order_id));
  const digitsOf = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
  const nameOf = (o: CampaignOrder) => names.get(o.shopify_order_id ?? "") ?? null;

  let order = orderId ? (orders.find((o) => o.id === orderId) ?? null) : null;

  const bytes = await photo.arrayBuffer();
  let check = await checkReceiptPhoto({
    bytes,
    contentType: photo.type,
    order: {
      orderNumber: order ? nameOf(order) : null,
      invoiceNo: order?.invoice_no ?? null,
      total: order ? Number(order.amount) : 0,
      paidAt: order?.confirmed_at ?? null,
      items: (order?.line_items ?? []).map((li) => `variant ${li.variantId} x${li.quantity}`),
    },
  });

  if (!order) {
    // Nothing to compare against on that pass, so only the reading survives
    // it — the verdict is decided on submit, against the order the number
    // turns out to name.
    const typed = digitsOf(check?.read?.orderNumber);
    order = typed ? (orders.find((o) => digitsOf(nameOf(o)) === typed) ?? null) : null;
    check = null;
  }

  const amounts = order ? amountsFromLineItems(order.line_items, content.rules) : null;

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
          orderNumber: nameOf(order),
          invoiceNo: order.invoice_no,
          paidAt: order.confirmed_at,
          total: Number(order.amount),
          dentisteAmount: amounts?.dentisteAmount ?? 0,
          entries: amounts ? computeEntries(amounts, content.rules) : 0,
        }
      : null,
  });
}
