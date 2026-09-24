import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { signedReceiptUrl } from "@/lib/receipt-photos";
import { holdsPrize } from "@/lib/receipt-campaign";
import { orderPaymentByGid } from "@/lib/shopify-admin";

// The review queue, the VIP order, and what Lucky Fan has to draw from.
//
// One read rather than three screens' worth: the three views answer different
// questions about the same rows, and an admin deciding whether to approve a
// receipt is usually also the one being asked "am I in the top 25 yet".
//
// VIP is first come first serve. Which moment that is measured from is still a
// question for the marketing team (the purchase, or the approval), so both are
// returned and the screen says which one it is ordering by — guessing would
// quietly decide a ฿55,000 prize.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPAIGN = "dentiste-x-kengnamping";
/** Winners, and the reserve list called on when someone does not confirm. */
const VIP_WINNERS = 25;
const VIP_RESERVE = 10;

type Row = {
  id: string;
  user_id: string;
  payment_transaction_id: string | null;
  manual_receipt_no: string | null;
  receipt_photo_path: string;
  dentiste_net_amount: number;
  keychain_amount: number;
  computed_entries: number;
  entries_override: number | null;
  status: "pending_review" | "approved" | "rejected";
  reject_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  ai_check: { verdict: "ok" | "unclear" | "mismatch"; message: string; findings: string[] } | null;
  users: { display_name: string | null } | null;
  payment_transactions: { invoice_no: string; amount: number; confirmed_at: string | null; shopify_order_id: string | null } | null;
};

const SELECT =
  "id,user_id,payment_transaction_id,manual_receipt_no,receipt_photo_path,dentiste_net_amount," +
  "keychain_amount,computed_entries,entries_override,status,reject_reason,reviewed_at,created_at,ai_check," +
  "users(display_name),payment_transactions(invoice_no,amount,confirmed_at,shopify_order_id)";

type WinnerRow = {
  id: string;
  prize_type: "vip" | "lucky_fan";
  rank: number;
  user_id: string;
  status: "pending_confirm" | "confirmed" | "forfeited";
  confirm_deadline: string;
  drawn_at: string;
  users: { display_name: string | null } | null;
};

const entriesOf = (r: Row) => r.entries_override ?? r.computed_entries;

/**
 * The number printed on what the customer actually uploads.
 *
 * They send a screenshot of Shopify's order confirmation email, which says
 * "ORDER #4292" — our own invoice_no is 2C2P's and appears nowhere on it. A
 * reviewer comparing the photo against a number that is not on the photo is
 * being asked to do the one thing this screen exists for, without the means.
 */

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const [rows, winners] = await Promise.all([
    supabaseRest<Row[]>(
      `receipt_campaign_entries?campaign_key=eq.${CAMPAIGN}&select=${SELECT}&order=created_at.asc&limit=2000`
    ).catch(() => [] as Row[]),
    supabaseRest<WinnerRow[]>(
      `receipt_campaign_winners?campaign_key=eq.${CAMPAIGN}` +
        `&select=id,prize_type,rank,user_id,status,confirm_deadline,drawn_at,users(display_name)` +
        `&order=prize_type.asc,rank.asc&limit=200`
    ).catch(() => [] as WinnerRow[]),
  ]);

  // Oldest first: the queue is worked in the order receipts arrived, which is
  // the same order VIP is decided in if the answer turns out to be "approval".
  const pending = rows.filter((r) => r.status === "pending_review");
  const approved = rows.filter((r) => r.status === "approved");

  // A photo link that expires in five minutes, made only for the queue an
  // admin is about to look at — not for every row ever submitted.
  // The order numbers, asked for in one go before the rows are built. What we
  // store is Shopify's internal id; what the receipt in the photo shows is the
  // order's name, and those are the two numbers a reviewer is comparing.
  const queuePage = pending.slice(0, 50);
  const payments = await orderPaymentByGid(queuePage.map((r) => r.payment_transactions?.shopify_order_id));

  const queue = await Promise.all(
    queuePage.map(async (r) => ({
      id: r.id,
      customer: r.users?.display_name ?? null,
      orderNumber: payments.get(r.payment_transactions?.shopify_order_id ?? "")?.name ?? null,
      // Straight from Shopify, not from our own "the card cleared" row.
      paymentStatus: payments.get(r.payment_transactions?.shopify_order_id ?? "")?.financialStatus ?? null,
      refunded: payments.get(r.payment_transactions?.shopify_order_id ?? "")?.refunded ?? 0,
      invoiceNo: r.payment_transactions?.invoice_no ?? r.manual_receipt_no,
      paidAt: r.payment_transactions?.confirmed_at ?? null,
      orderTotal: r.payment_transactions ? Number(r.payment_transactions.amount) : null,
      dentisteAmount: Number(r.dentiste_net_amount),
      keychainAmount: Number(r.keychain_amount),
      entries: entriesOf(r),
      sentAt: r.created_at,
      photoUrl: await signedReceiptUrl(r.receipt_photo_path),
      aiCheck: r.ai_check,
    }))
  );

  // VIP: one place in line per person, taken by their earliest approved
  // receipt. Someone who sent three does not occupy three of the twenty-five.
  const firstApproval = new Map<string, Row>();
  for (const r of approved) {
    const seen = firstApproval.get(r.user_id);
    if (!seen || r.created_at < seen.created_at) firstApproval.set(r.user_id, r);
  }
  const byPurchase = [...firstApproval.values()].sort((a, b) =>
    (a.payment_transactions?.confirmed_at ?? a.created_at).localeCompare(
      b.payment_transactions?.confirmed_at ?? b.created_at
    )
  );

  // Lucky Fan draws from entries, not from people: more entries, more tickets.
  const tickets = new Map<string, { name: string | null; entries: number }>();
  for (const r of approved) {
    const cur = tickets.get(r.user_id) ?? { name: r.users?.display_name ?? null, entries: 0 };
    cur.entries += entriesOf(r);
    tickets.set(r.user_id, cur);
  }

  return NextResponse.json(
    {
      ok: true,
      counts: {
        pending: pending.length,
        approved: approved.length,
        rejected: rows.length - pending.length - approved.length,
        entrants: tickets.size,
        tickets: [...tickets.values()].reduce((n, t) => n + t.entries, 0),
      },
      queue,
      pendingBeyondQueue: Math.max(0, pending.length - queue.length),
      vip: byPurchase.slice(0, VIP_WINNERS + VIP_RESERVE).map((r, i) => ({
        rank: i + 1,
        userId: r.user_id,
        customer: r.users?.display_name ?? null,
        invoiceNo: r.payment_transactions?.invoice_no ?? r.manual_receipt_no,
        paidAt: r.payment_transactions?.confirmed_at ?? null,
        approvedAt: r.reviewed_at,
        reserve: i >= VIP_WINNERS,
      })),
      // Who is holding a prize right now, which is not the same as who was
      // drawn into the first 25: a forfeit above you promotes you.
      winners: (() => {
        const holding = new Set<string>();
        for (const type of ["vip", "lucky_fan"] as const) {
          for (const w of holdsPrize(winners.filter((x) => x.prize_type === type))) holding.add(w.id);
        }
        return winners.map((w) => ({
          id: w.id,
          prizeType: w.prize_type,
          rank: w.rank,
          customer: w.users?.display_name ?? null,
          status: w.status,
          holding: holding.has(w.id),
          confirmDeadline: w.confirm_deadline,
          drawnAt: w.drawn_at,
        }));
      })(),
      luckyFan: [...tickets.entries()]
        .map(([userId, t]) => ({ userId, customer: t.name, entries: t.entries }))
        .sort((a, b) => b.entries - a.entries)
        .slice(0, 200),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
