import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { isDentisteVendor } from "@/lib/receipt-campaign";
import { paidOrdersSince } from "@/lib/shopify-admin";

// What DENTISTE' has actually sold since the campaign opened.
//
// Read from Shopify rather than from our own receipts: a receipt is a claim a
// customer chose to make, and most buyers never make one. The shop's paid
// orders are the sales. The two numbers are meant to differ, and the campaign
// team asking "how much have we sold" is asking about this one.
//
// Its own route rather than part of /api/admin/receipts, because that one
// loads on every visit to the console and this walks a date range that only
// gets longer. The tab pays for its own query, when it is opened.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The day the campaign opened; sales are counted from here. */
const DEFAULT_SINCE = "2026-09-28";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }

  const asked = req.nextUrl.searchParams.get("since");
  const since = asked && DATE_RE.test(asked) ? asked : DEFAULT_SINCE;

  const orders = await paidOrdersSince(since);
  if (!orders) {
    return NextResponse.json({ ok: false, error: "เชื่อมต่อ Shopify ไม่ได้ในขณะนี้" }, { status: 502 });
  }

  // Only the DENTISTE' money out of each order. An order can mix brands, and
  // half of these do; counting the order total would credit the campaign with
  // every Smooth E tube that happened to ride along.
  const rows = orders
    .map((o) => {
      // Paid DENTISTE' lines only. A free gift is a DENTISTE' line worth
      // nothing once its discount is taken off, and counting it would add
      // pieces to the tally that nobody bought.
      const lines = o.lines.filter((l) => isDentisteVendor(l.vendor) && l.amount > 0);
      const amount = lines.reduce((sum, l) => sum + l.amount, 0);
      const units = lines.reduce((sum, l) => sum + l.quantity, 0);
      return {
        orderName: o.orderName,
        adminUrl: o.adminUrl,
        paidAt: o.processedAt,
        customer: o.customerName,
        email: o.customerEmail,
        amount,
        units,
        orderTotal: o.total,
        // Named so the screen can say what was bought without a second call.
        items: lines.map((l) => ({ title: l.title, quantity: l.quantity, amount: l.amount })),
      };
    })
    // An order whose only DENTISTE' lines were gifts bought nothing here.
    .filter((r) => r.amount > 0);

  return NextResponse.json({
    ok: true,
    since,
    orders: rows,
    totals: {
      orders: rows.length,
      units: rows.reduce((sum, r) => sum + r.units, 0),
      amount: rows.reduce((sum, r) => sum + r.amount, 0),
    },
  });
}
