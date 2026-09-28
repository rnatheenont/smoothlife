import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { signedReceiptUrl } from "@/lib/receipt-photos";
import { amountsFromLineItems, holdsPrize, type LineItem } from "@/lib/receipt-campaign";
import { loadCampaignContent } from "@/lib/receipt-campaign-content";
import { orderPaymentByGid, ordersByName, normalizeOrderName } from "@/lib/shopify-admin";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";

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

/** Which campaign this console is looking at; the first one when unstated. */
const campaignOf = (req: NextRequest) => campaignKeyFrom(req.nextUrl.searchParams.get("campaign"));
/** Winners, and the reserve list called on when someone does not confirm. */
const VIP_WINNERS = 25;
const VIP_RESERVE = 10;

type EntryRow = {
  id: string;
  user_id: string;
  payment_transaction_id: string | null;
  manual_receipt_no: string | null;
  receipt_photo_path: string;
  dentiste_net_amount: number;
  keychain_amount: number;
  computed_entries: number;
  entries_override: number | null;
  status: "pending_review" | "approved" | "rejected" | "revoked";
  revoke_reason?: string | null;
  reject_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  ai_check: { verdict: "ok" | "unclear" | "mismatch"; message: string; findings: string[] } | null;
  users: { display_name: string | null; shopify_customer_id?: string | null; phone?: string | null } | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  declared_order_number?: string | null;
  declared_paid_at?: string | null;
  declared_total?: number | string | null;
  payment_transactions: {
    invoice_no: string;
    amount: number;
    confirmed_at: string | null;
    shopify_order_id: string | null;
    line_items: LineItem[] | null;
  } | null;
};

const SELECT =
  "id,user_id,payment_transaction_id,manual_receipt_no,receipt_photo_path,dentiste_net_amount," +
  "keychain_amount,computed_entries,entries_override,status,reject_reason,reviewed_at,created_at,ai_check," +
  "revoke_reason,contact_name,contact_phone,contact_email,declared_order_number,declared_paid_at,declared_total," +
  "users(display_name,shopify_customer_id,phone),payment_transactions(invoice_no,amount,confirmed_at,shopify_order_id,line_items)";

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

const entriesOf = (r: EntryRow) => r.entries_override ?? r.computed_entries;

/**
 * The number printed on what the customer actually uploads.
 *
 * They send a screenshot of Shopify's order confirmation email, which says
 * "ORDER #4292" — our own invoice_no is 2C2P's and appears nowhere on it. A
 * reviewer comparing the photo against a number that is not on the photo is
 * being asked to do the one thing this screen exists for, without the means.
 */

export async function GET(req: NextRequest) {
  const CAMPAIGN = campaignOf(req);
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const [rows, winners] = await Promise.all([
    supabaseRest<EntryRow[]>(
      `receipt_campaign_entries?campaign_key=eq.${CAMPAIGN}&select=${SELECT}&order=created_at.asc&limit=2000`
    ).catch(() => [] as EntryRow[]),
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
  // Decided receipts, newest first: this list exists to be corrected, and the
  // mistake somebody wants back is nearly always the one just made.
  const decidedPage = rows
    .filter((r) => r.status !== "pending_review")
    .sort((a, b) => (b.reviewed_at ?? b.created_at).localeCompare(a.reviewed_at ?? a.created_at))
    .slice(0, 50);

  const queuePage = pending.slice(0, 50);
  // The rules as they stand now, so the line-by-line breakdown labels a
  // keychain set the same way the calculation does.
  const { rules } = await loadCampaignContent(CAMPAIGN);
  const payments = await orderPaymentByGid(
    [...queuePage, ...decidedPage].map((r) => r.payment_transactions?.shopify_order_id)
  );

  // The order the customer says their receipt is for, looked up by that
  // number in the shop — not among their own orders.
  //
  // An entry with no transaction behind it used to be a dead end: the status
  // read "อ่านไม่ได้" and the reviewer had to go and search Shopify by hand
  // to learn anything at all. The number is right there on the claim, and
  // Shopify will say whether such an order exists, whether the money is still
  // there, and whose order it is — which is the question the reviewer is
  // actually asking when the number came from a receipt rather than from us.
  const claimed = await ordersByName(
    [...queuePage, ...decidedPage]
      .filter((r) => !r.payment_transaction_id)
      .map((r) => r.declared_order_number ?? r.manual_receipt_no)
  ).catch(() => new Map());

  /**
   * What the shop knows about the number on this claim.
   *
   * `belongsToCustomer` is the part worth a reviewer's attention: an order
   * that exists and is paid can still be somebody else's, and approving it
   * hands this customer entries earned by a stranger's purchase. Ownership is
   * settled by Shopify's customer id where we have one for both sides, and
   * otherwise by the phone number on the order — the same evidence a person
   * would use, with "we could not tell" kept separate from "no".
   */
  const claimedOrderOf = (r: EntryRow) => {
    if (r.payment_transaction_id) return null;
    const key = normalizeOrderName(r.declared_order_number ?? r.manual_receipt_no);
    if (!key) return null;
    const order = claimed.get(key);
    if (!order) return { found: false as const, number: `#${key}` };

    const sameId = Boolean(r.users?.shopify_customer_id && order.customerId &&
      String(r.users.shopify_customer_id).replace(/\D/g, "") === order.customerId.replace(/\D/g, ""));
    const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "").slice(-9);
    const samePhone = Boolean(digits(r.contact_phone ?? r.users?.phone) &&
      digits(r.contact_phone ?? r.users?.phone) === digits(order.customerPhone));
    const known = Boolean(r.users?.shopify_customer_id || r.contact_phone || r.users?.phone);

    return {
      found: true as const,
      number: order.name,
      adminUrl: order.adminUrl,
      financialStatus: order.financialStatus,
      total: order.total,
      refunded: order.refunded,
      paidAt: order.paidAt,
      ownerLabel: order.customerLabel,
      belongsToCustomer: sameId || samePhone ? true : known ? false : null,
    };
  };

  const asRow = async (r: EntryRow) => ({
      id: r.id,
      status: r.status,
      reviewedAt: r.reviewed_at ?? null,
      rejectReason: r.reject_reason ?? null,
      revokeReason: r.revoke_reason ?? null,
      customer: r.users?.display_name ?? null,
      orderNumber: payments.get(r.payment_transactions?.shopify_order_id ?? "")?.name ?? null,
      // No order row behind it at all: the customer's receipt for a purchase
      // this site never recorded. Nothing here was computed, so nothing here
      // can be checked against anything but the photo and the reviewer.
      manual: !r.payment_transaction_id && Boolean(r.manual_receipt_no),
      // Straight from Shopify, not from our own "the card cleared" row.
      paymentStatus: payments.get(r.payment_transactions?.shopify_order_id ?? "")?.financialStatus ?? null,
      refunded: payments.get(r.payment_transactions?.shopify_order_id ?? "")?.refunded ?? 0,
      invoiceNo: r.payment_transactions?.invoice_no ?? r.manual_receipt_no,
      paidAt: r.payment_transactions?.confirmed_at ?? null,
      orderTotal: r.payment_transactions ? Number(r.payment_transactions.amount) : null,
      dentisteAmount: Number(r.dentiste_net_amount),
      // The bill line by line, worked out from the order that is still on the
      // row — "฿1,600 of Dentiste" does not say whether that was one set or
      // six tubes, and the photo beside it lists both.
      lines: amountsFromLineItems(r.payment_transactions?.line_items, rules).lines,
      keychainAmount: Number(r.keychain_amount),
      entries: entriesOf(r),
      sentAt: r.created_at,
      // The customer's own account of the receipt, next to the shop's record
      // of the order — the two disagreeing is the thing worth a second look.
      contactName: r.contact_name ?? null,
      contactPhone: r.contact_phone ?? null,
      contactEmail: r.contact_email ?? null,
      declared: {
        orderNumber: r.declared_order_number ?? null,
        paidAt: r.declared_paid_at ?? null,
        total: r.declared_total === null || r.declared_total === undefined ? null : Number(r.declared_total),
      },
      photoUrl: await signedReceiptUrl(r.receipt_photo_path),
      aiCheck: r.ai_check,
      claimedOrder: claimedOrderOf(r),
  });

  const [queue, decided] = await Promise.all([
    Promise.all(queuePage.map(asRow)),
    Promise.all(decidedPage.map(asRow)),
  ]);

  // VIP: one place in line per person, taken by their earliest approved
  // receipt. Someone who sent three does not occupy three of the twenty-five.
  const firstApproval = new Map<string, EntryRow>();
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
      decided,
      decidedTotal: rows.filter((r) => r.status !== "pending_review").length,
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
