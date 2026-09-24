import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { signedReceiptUrl } from "@/lib/receipt-photos";

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
  users: { display_name: string | null } | null;
  payment_transactions: { invoice_no: string; amount: number; confirmed_at: string | null } | null;
};

const SELECT =
  "id,user_id,payment_transaction_id,manual_receipt_no,receipt_photo_path,dentiste_net_amount," +
  "keychain_amount,computed_entries,entries_override,status,reject_reason,reviewed_at,created_at," +
  "users(display_name),payment_transactions(invoice_no,amount,confirmed_at)";

const entriesOf = (r: Row) => r.entries_override ?? r.computed_entries;

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const rows = await supabaseRest<Row[]>(
    `receipt_campaign_entries?campaign_key=eq.${CAMPAIGN}&select=${SELECT}&order=created_at.asc&limit=2000`
  ).catch(() => [] as Row[]);

  // Oldest first: the queue is worked in the order receipts arrived, which is
  // the same order VIP is decided in if the answer turns out to be "approval".
  const pending = rows.filter((r) => r.status === "pending_review");
  const approved = rows.filter((r) => r.status === "approved");

  // A photo link that expires in five minutes, made only for the queue an
  // admin is about to look at — not for every row ever submitted.
  const queue = await Promise.all(
    pending.slice(0, 50).map(async (r) => ({
      id: r.id,
      customer: r.users?.display_name ?? null,
      invoiceNo: r.payment_transactions?.invoice_no ?? r.manual_receipt_no,
      paidAt: r.payment_transactions?.confirmed_at ?? null,
      orderTotal: r.payment_transactions ? Number(r.payment_transactions.amount) : null,
      dentisteAmount: Number(r.dentiste_net_amount),
      keychainAmount: Number(r.keychain_amount),
      entries: entriesOf(r),
      sentAt: r.created_at,
      photoUrl: await signedReceiptUrl(r.receipt_photo_path),
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
      luckyFan: [...tickets.entries()]
        .map(([userId, t]) => ({ userId, customer: t.name, entries: t.entries }))
        .sort((a, b) => b.entries - a.entries)
        .slice(0, 200),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
