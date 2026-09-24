import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { inquireTransactionStatus, twoC2PConfigured } from "@/lib/2c2p";
import { FLASH_SALE_TX_COLUMNS, type FlashSaleTransaction } from "@/lib/flash-sale-orders";
import { settleFlashSaleCharge } from "@/lib/flash-sale-settlement";

// Asking 2C2P what actually happened, for the payments our own database is not
// sure about.
//
// Our row is written by the backendReturnUrl webhook and by nothing else, so a
// webhook that never arrives leaves the row `pending` with no tranRef for good.
// That is not "the payment failed" — it is "we do not know", and the difference
// is a customer whose money left their account and who has neither the product
// nor a refund. 2C2P has known the answer the whole time; inquireTransactionStatus
// has existed the whole time; nothing called it.
//
// GET reports both sides and changes nothing, so it is safe to run on a hunch.
// POST applies one invoice's real outcome, which can confirm a reservation and
// create the Shopify order that should have existed — the same steps the webhook
// would have taken, from flash-sale-settlement.ts.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 2C2P's own wording: 0000 is the only code that means the money moved. */
const PAID = "0000";

type Row = {
  id: string;
  invoice_no: string;
  amount: number;
  status: string;
  resp_code: string | null;
  resp_desc: string | null;
  tran_ref: string | null;
  shopify_order_id: string | null;
  flash_sale_entry_id: string | null;
  contact_phone: string | null;
  created_at: string;
};

const ROW_COLUMNS =
  "id,invoice_no,amount,status,resp_code,resp_desc,tran_ref,shopify_order_id,flash_sale_entry_id,contact_phone,created_at";

type Verdict =
  /** 2C2P says paid and our row already says so. */
  | "agreed_paid"
  /** 2C2P says not paid and our row already says so. */
  | "agreed_unpaid"
  /** The money moved and our row never learned. Someone paid for nothing. */
  | "paid_not_recorded"
  /** Our row claims a success 2C2P does not have. */
  | "recorded_not_paid"
  /** 2C2P has no record, or would not answer. */
  | "no_answer";

function verdictFor(row: Row, theirs: { respCode: string } | null): Verdict {
  if (!theirs) return "no_answer";
  const theyPaid = theirs.respCode === PAID;
  const wePaid = row.status === "success";
  if (theyPaid && wePaid) return "agreed_paid";
  if (!theyPaid && !wePaid) return "agreed_unpaid";
  return theyPaid ? "paid_not_recorded" : "recorded_not_paid";
}

async function inquire(invoiceNo: string) {
  try {
    const r = await inquireTransactionStatus(invoiceNo);
    return { ok: true as const, respCode: r.respCode, respDesc: r.respDesc, amount: Number(r.amount), tranRef: r.tranRef };
  } catch (err) {
    // A transaction 2C2P has never heard of answers the same way as a network
    // failure, so this says "no answer" rather than guessing which.
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  if (!twoC2PConfigured()) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า 2C2P" }, { status: 503 });

  const params = req.nextUrl.searchParams;
  const hours = Math.min(Math.max(Number(params.get("hours")) || 72, 1), 24 * 30);
  // Every row is one call to 2C2P, so the window is bounded and so is the page.
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 200);
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  // "success" rows are included too: a row claiming money that never moved is
  // rarer and worse than the other way round, and only 2C2P can tell us.
  const rows = await supabaseRest<Row[]>(
    `payment_transactions?created_at=gte.${encodeURIComponent(since)}&select=${ROW_COLUMNS}` +
      `&order=created_at.desc&limit=${limit}`
  );

  const results = [];
  for (const row of rows) {
    const theirs = await inquire(row.invoice_no);
    results.push({
      invoiceNo: row.invoice_no,
      createdAt: row.created_at,
      amount: Number(row.amount),
      contactPhone: row.contact_phone,
      isFlashSale: Boolean(row.flash_sale_entry_id),
      shopifyOrderId: row.shopify_order_id,
      ours: { status: row.status, respCode: row.resp_code, respDesc: row.resp_desc, tranRef: row.tran_ref },
      theirs: theirs.ok
        ? { respCode: theirs.respCode, respDesc: theirs.respDesc, amount: theirs.amount, tranRef: theirs.tranRef }
        : null,
      error: theirs.ok ? null : theirs.error,
      verdict: verdictFor(row, theirs.ok ? theirs : null),
    });
  }

  const count = (v: Verdict) => results.filter((r) => r.verdict === v).length;
  return NextResponse.json({
    ok: true,
    window: { hours, since, checked: results.length },
    summary: {
      paidNotRecorded: count("paid_not_recorded"),
      recordedNotPaid: count("recorded_not_paid"),
      noAnswer: count("no_answer"),
      agreed: count("agreed_paid") + count("agreed_unpaid"),
    },
    // Whatever needs a person comes first.
    transactions: results.sort((a, b) => {
      const weight = (v: string) => (v === "paid_not_recorded" ? 0 : v === "recorded_not_paid" ? 1 : v === "no_answer" ? 2 : 3);
      return weight(a.verdict) - weight(b.verdict);
    }),
  });
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  if (!twoC2PConfigured()) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า 2C2P" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const invoiceNo = typeof body?.invoiceNo === "string" ? body.invoiceNo.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,30}$/.test(invoiceNo)) {
    return NextResponse.json({ ok: false, error: "เลขที่ใบแจ้งหนี้ไม่ถูกต้อง" }, { status: 400 });
  }

  const [row] = await supabaseRest<(FlashSaleTransaction & Row)[]>(
    `payment_transactions?invoice_no=eq.${pgValue(invoiceNo)}&select=${FLASH_SALE_TX_COLUMNS},${ROW_COLUMNS}&limit=1`
  );
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });

  const theirs = await inquire(invoiceNo);
  if (!theirs.ok) return NextResponse.json({ ok: false, error: `2C2P ไม่ตอบ: ${theirs.error}` }, { status: 502 });

  // Nothing is corrected on a guess: what 2C2P just said is written down first,
  // with who asked and what the row looked like before.
  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: "checkout.reconcile",
      target: row.id,
      detail: {
        invoiceNo,
        before: { status: row.status, respCode: row.resp_code, tranRef: row.tran_ref },
        inquiry: { respCode: theirs.respCode, respDesc: theirs.respDesc, amount: theirs.amount, tranRef: theirs.tranRef },
      },
    }),
  }).catch((err) => console.error("[checkout-transactions/reconcile] audit write failed", err));

  if (!row.flash_sale_entry_id) {
    // A regular-checkout charge settles through its own webhook, which does
    // more than this one (cart, discounts, the Shopify order it builds itself).
    // Reporting the difference is useful; half-applying it would not be.
    return NextResponse.json({
      ok: true,
      applied: false,
      reason: "ยังรองรับเฉพาะรายการ Flash Sale — รายการนี้เป็นการสั่งซื้อปกติ กรุณาตรวจสอบเอง",
      inquiry: theirs,
    });
  }

  const result = await settleFlashSaleCharge(row, {
    invoiceNo,
    amount: theirs.amount,
    respCode: theirs.respCode,
    respDesc: theirs.respDesc,
    tranRef: theirs.tranRef,
  });
  return NextResponse.json({ ok: true, applied: result !== "already_processed", result, inquiry: theirs });
}
