import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// The payments that never became an order — the ones the account page used to
// be silent about.
//
// /account/orders reads Shopify, so a charge that failed, or one we never heard
// the result of, appears nowhere at all: the customer tried to buy, saw money
// leave their banking app, came back, and found a page that does not mention it.
// The commonest cause is a bank holding the amount on a card it then declined,
// which drops off by itself — but saying nothing leaves them to assume the
// worst, and to try again, and to be held twice.
//
// Read-only, the signed-in customer's own rows, and only ones that produced no
// order. A charge older than two weeks is either settled or a support case.

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 14;
/** Below this a pending charge is simply still in flight; above it, unresolved. */
const IN_FLIGHT_MS = 15 * 60 * 1000;
/**
 * And above THIS it is almost always an abandoned payment page — someone opened
 * 2C2P and closed it, which leaves the same row as a charge we never heard back
 * about. Promising to look into every one of those would be a promise made
 * mostly to people who never paid, so after two days it drops off the page and
 * the admin reconciliation is what catches the rare real one.
 */
const STALE_MS = 48 * 60 * 60 * 1000;

type Row = {
  invoice_no: string;
  amount: number;
  status: string;
  resp_desc: string | null;
  refund_note: string | null;
  flash_sale_entry_id: string | null;
  created_at: string;
};

export type AccountPaymentKind = "failed" | "unresolved" | "paid_no_order" | "refund_pending";

export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, payments: [] }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, payments: [] });

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const rows = await supabaseRest<Row[]>(
    `payment_transactions?user_id=eq.${pgValue(uid)}&created_at=gte.${encodeURIComponent(since)}` +
      `&shopify_order_id=is.null&select=invoice_no,amount,status,resp_desc,refund_note,flash_sale_entry_id,created_at` +
      `&order=created_at.desc&limit=50`
  ).catch(() => [] as Row[]);

  const now = Date.now();
  const items = [];
  for (const row of rows) {
    const age = now - Date.parse(row.created_at);
    let kind: AccountPaymentKind;
    if (row.status === "success") {
      kind = row.refund_note ? "refund_pending" : "paid_no_order";
    } else if (row.status === "failed") {
      kind = "failed";
    } else {
      // Still on the payment page, most likely. Nothing to say yet.
      if (age < IN_FLIGHT_MS || age > STALE_MS) continue;
      kind = "unresolved";
    }
    items.push({
      invoiceNo: row.invoice_no,
      amount: Number(row.amount),
      createdAt: row.created_at,
      isFlashSale: Boolean(row.flash_sale_entry_id),
      kind,
      attempts: 1,
    });
  }

  // Four taps on a payment button in ten minutes is one attempt to buy one
  // thing, and listing it four times reads as four problems. Same amount, same
  // day, same outcome collapses into one line that says how many tries it took.
  const grouped: typeof items = [];
  for (const item of items) {
    const day = item.createdAt.slice(0, 10);
    const previous = grouped.find(
      (g) => g.amount === item.amount && g.kind === item.kind && g.createdAt.slice(0, 10) === day
    );
    if (previous) previous.attempts += 1;
    else grouped.push(item);
  }

  return NextResponse.json({ ok: true, payments: grouped }, { headers: { "Cache-Control": "no-store" } });
}
