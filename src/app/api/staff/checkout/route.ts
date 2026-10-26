import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isRateLimitedShared } from "@/lib/rate-limit";
import { createPaymentToken, twoC2PConfigured } from "@/lib/2c2p";
import { paymentChannelsFor } from "@/lib/payment-limits";
import { releaseStock, reserveStock } from "@/lib/stock-reservation";
import { reasonTh, type StaffOrderLine } from "@/lib/staff-sale";
import { staffRpc, type RpcResult } from "@/lib/staff-sale-rpc";
import {
  currentStaffRound,
  staffInvoiceNo,
  staffShippingAddress,
  staffStanding,
} from "@/lib/staff-shop";

// Opens a payment for a staff cart.
//
// Separate from /api/checkout/init on purpose, and not a flag on it: the
// customer checkout prices from the catalogue, writes marketing attribution,
// and hands the paid order to handleOrdersPaid, which awards points and
// referral commission. A staff purchase must do none of those four things,
// and the way to be sure of that is not to run that code.
//
// The order of operations is the part that matters:
//   1. staff_create_order — one locked transaction, which is what makes the
//      spending cap and the quota real
//   2. the payment reference, before any payment page can exist
//   3. Shopify's stock, best effort (see below)
//   4. 2C2P's token last, because it is the only step that cannot be undone
//      by writing a row

export async function POST(req: NextRequest) {
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }
  if (!twoC2PConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบชำระเงินยังไม่พร้อมใช้งาน" }, { status: 503 });
  }
  if (await isRateLimitedShared(`staff-checkout:${userId}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "เริ่มการชำระเงินบ่อยเกินไป รอสักครู่แล้วลองใหม่" },
      { status: 429 },
    );
  }

  const round = await currentStaffRound();
  if (!round) {
    return NextResponse.json({ ok: false, error: "รอบการซื้อปิดแล้ว" }, { status: 409 });
  }
  const standing = await staffStanding(round.id, userId);
  if (!standing) {
    return NextResponse.json(
      { ok: false, error: "กรุณายืนยันอีเมลพนักงานสำหรับรอบนี้ก่อน" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as { lines?: unknown } | null;
  const rawLines = Array.isArray(body?.lines) ? body!.lines : [];
  if (rawLines.length === 0) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้เลือกสินค้า" }, { status: 400 });
  }
  if (rawLines.length > 50) {
    return NextResponse.json({ ok: false, error: "เลือกสินค้าได้ไม่เกิน 50 รายการ" }, { status: 400 });
  }
  // Variant and quantity only. A price in this body would be ignored
  // anyway — staff_create_order reads every price from the round — but not
  // accepting one keeps that unambiguous.
  const lines = rawLines.map((l) => {
    const line = (l ?? {}) as Record<string, unknown>;
    return { variant_id: String(line.variant_id ?? ""), qty: Number(line.qty ?? 0) };
  });
  if (lines.some((l) => !l.variant_id || !Number.isInteger(l.qty) || l.qty < 1)) {
    return NextResponse.json({ ok: false, error: "รายการสินค้าไม่ถูกต้อง" }, { status: 400 });
  }

  const address = await staffShippingAddress(userId);
  // A name as well as a number: a staff parcel is a parcel, and the courier
  // asks for somebody at the door. Same rule the customer checkout now
  // holds to.
  if (!address || !address.phone || !address.firstName) {
    return NextResponse.json(
      {
        ok: false,
        error: "กรุณาเพิ่มชื่อผู้รับ ที่อยู่จัดส่ง และเบอร์โทรในหน้าโปรไฟล์ก่อนสั่งซื้อ",
        needsAddress: true,
      },
      { status: 400 },
    );
  }

  // 1. The cap, the per-person limit and the quota, in one locked step.
  const created = await staffRpc<RpcResult>("staff_create_order", {
    p_round: round.id,
    p_user: userId,
    p_lines: lines,
  });
  if (!created?.ok) {
    return NextResponse.json(
      { ok: false, error: reasonTh(created?.reason), reason: created?.reason, detail: created?.detail },
      { status: 409 },
    );
  }

  const orderId = String(created.order_id);
  const subtotal = Number(created.subtotal_thb);
  const expiresAt = new Date(String(created.expires_at));
  const orderLines = (created.lines ?? []) as StaffOrderLine[];
  const invoiceNo = staffInvoiceNo();
  const cartToken = `staff-${randomUUID()}`;

  /** Undo everything the database knows about, in the reverse order. */
  async function rollback(reason: string) {
    console.error("[staff/checkout] rolling back", { orderId, invoiceNo, reason });
    await releaseStock(cartToken).catch(() => {});
    await supabaseRest(`payment_transactions?invoice_no=eq.${pgValue(invoiceNo)}&status=eq.pending`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "failed", resp_desc: reason.slice(0, 200) }),
    }).catch(() => {});
    await staffRpc("staff_cancel_order", { p_order: orderId, p_user: null }).catch(() => {});
  }

  // 2. The reference, written before a payment page exists. The webhook
  // finds the order by this and nothing else, so an order that could be
  // paid before it is set would be money with no order attached to it.
  try {
    await supabaseRest(`staff_orders?id=eq.${pgValue(orderId)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ payment_reference: invoiceNo }),
    });
  } catch (err) {
    await rollback("could not set payment reference");
    console.error("[staff/checkout] payment_reference failed", err);
    return NextResponse.json({ ok: false, error: "เริ่มการชำระเงินไม่สำเร็จ" }, { status: 502 });
  }

  // 3. Shopify's own stock. Best effort by design: reserveStock reads then
  // writes, so under heavy simultaneous use it can let one unit through —
  // the round's `total_quota` is the guard that cannot. Worth doing anyway,
  // because it stops a staff order and a customer order from both taking
  // the last unit in the ordinary case.
  const reservation = await reserveStock(
    cartToken,
    orderLines.map((l) => ({ variantId: l.variant_id, quantity: Number(l.qty) })),
    // A Shopify read that fails is not a reason to refuse a staff order —
    // the round's own quota is the guard that counts. Same policy as
    // reserveStock's own "couldn't verify, don't block".
  ).catch(() => null);
  const shortIds = reservation && reservation.ok === false ? reservation.shortVariantIds : null;
  if (shortIds) {
    await rollback("out of stock in Shopify");
    const short = orderLines
      .filter((l) => shortIds.includes(l.variant_id))
      .map((l) => l.product_slug);
    return NextResponse.json(
      { ok: false, error: "สินค้าบางรายการหมดแล้ว", reason: "sold_out", shortProducts: short },
      { status: 409 },
    );
  }

  // The money row. No attribution columns and no flash_sale_entry_id: a
  // staff purchase is not a marketing conversion, and every report that
  // counts revenue filters on `staff_order_id is null`.
  await supabaseRest("payment_transactions", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      cart_token: cartToken,
      user_id: userId,
      amount: subtotal,
      currency_code: "THB",
      invoice_no: invoiceNo,
      status: "pending",
      contact_email: standing.staff_email,
      contact_phone: address.phone ?? null,
      shipping_address: address,
      line_items: orderLines.map((l) => ({
        variantId: l.variant_id,
        quantity: Number(l.qty),
        price: Number(l.staff_price),
      })),
      discount_amount: 0,
      staff_order_id: orderId,
      payment_channel: ["CC", "PPQR"],
    }),
  }).catch(async (err) => {
    await rollback("could not record the payment");
    throw err;
  });

  // 4. 2C2P last.
  const origin = req.nextUrl.origin;
  try {
    const result = await createPaymentToken({
      invoiceNo,
      description: `Staff Sale: ${round.name}`.slice(0, 250),
      amount: subtotal,
      // Which methods, and the ฿50,000 PromptPay ceiling with it, is
      // paymentChannelsFor's to decide — see @/lib/2c2p. A staff cart is
      // capped well under that today, but the cap is a round's setting and
      // this route should not be the one place that forgets.
      paymentChannel: paymentChannelsFor(subtotal),
      frontendReturnUrl: `${origin}/api/payments/return?next=staff`,
      backendReturnUrl: `${origin}/api/webhooks/2c2p-staff`,
      customer: { email: standing.staff_email, mobileNo: address.phone },
      shippingAddress: {
        address1: address.address1,
        city: address.city,
        postalCode: address.zip,
        countryCode: address.countryCode,
        state: address.province,
      },
      // The page and the hold expire together. A payment page that outlives
      // the reservation behind it is the flash sale's late-refund bug.
      paymentExpiry: expiresAt,
    });

    // Kept so an employee who closes the tab can come back to the same
    // payment page instead of a second invoice for one order. It dies with
    // the hold, because paymentExpiry is the hold's own deadline.
    await supabaseRest(`staff_orders?id=eq.${pgValue(orderId)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ payment_url: result.webPaymentUrl }),
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      webPaymentUrl: result.webPaymentUrl,
      orderId,
      invoiceNo,
      subtotal_thb: subtotal,
      expires_at: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[staff/checkout] 2C2P paymentToken failed", err);
    await rollback("2C2P paymentToken failed");
    return NextResponse.json(
      { ok: false, error: "เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
      { status: 502 },
    );
  }
}
