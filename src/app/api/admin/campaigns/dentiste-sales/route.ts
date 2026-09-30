import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { amountsFromLineItems, computeEntries, isDentisteVendor, type LineItem } from "@/lib/receipt-campaign";
import { loadCampaignContent } from "@/lib/receipt-campaign-content";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";
import { normalizeOrderName, paidOrdersSince } from "@/lib/shopify-admin";

// What DENTISTE' has actually sold since the campaign opened, and which of
// those bills their buyer has sent in.
//
// Sales are read from Shopify rather than from our own receipts: a receipt is
// a claim a customer chose to make, and most buyers never make one. The two
// numbers are meant to differ — the gap between them is how much of the
// campaign's audience has not claimed yet, which is the thing worth chasing.
//
// Its own route rather than part of /api/admin/receipts, because that one
// loads on every visit to the console and this walks a date range that only
// gets longer. The tab pays for its own query, when it is opened.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The day the campaign opened; sales are counted from here. */
const DEFAULT_SINCE = "2026-09-28";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ReceiptState = "approved" | "pending_review" | "rejected" | "revoked";

/** Which claim speaks for an order when its buyer sent more than one. */
const RANK: Record<ReceiptState, number> = { approved: 4, pending_review: 3, rejected: 2, revoked: 1 };

type EntryRow = {
  status: ReceiptState;
  declared_order_number: string | null;
  created_at: string;
  reviewed_at: string | null;
  contact_name: string | null;
  payment_transactions: { shopify_order_id: string | null } | null;
};

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }

  const asked = req.nextUrl.searchParams.get("since");
  const since = asked && DATE_RE.test(asked) ? asked : DEFAULT_SINCE;
  const campaign = campaignKeyFrom(req.nextUrl.searchParams.get("campaign"));

  // The same rules the receipt console scores a claim with, so "ได้กี่สิทธิ์"
  // is the same number in both places.
  const { rules } = await loadCampaignContent(campaign);

  const orders = await paidOrdersSince(since);
  if (!orders) {
    return NextResponse.json({ ok: false, error: "เชื่อมต่อ Shopify ไม่ได้ในขณะนี้" }, { status: 502 });
  }

  // The receipts already sent in, keyed by the order they name. Two keys per
  // claim: the order number the customer typed (with or without its "#" —
  // both spellings are in the table) and, for an on-site checkout, the
  // Shopify id our own transaction recorded.
  const claims = new Map<string, { state: ReceiptState; at: string; who: string | null; count: number }>();
  if (supabaseConfigured()) {
    const entries = await supabaseRest<EntryRow[]>(
      `receipt_campaign_entries?campaign_key=eq.${pgValue(campaign)}` +
        `&select=status,declared_order_number,created_at,reviewed_at,contact_name,payment_transactions(shopify_order_id)` +
        `&order=created_at.asc&limit=2000`
    ).catch(() => []);
    for (const e of entries) {
      const keys = [normalizeOrderName(e.declared_order_number), e.payment_transactions?.shopify_order_id ?? null];
      for (const key of keys) {
        if (!key) continue;
        const seen = claims.get(key);
        const next = { state: e.status, at: e.reviewed_at ?? e.created_at, who: e.contact_name, count: (seen?.count ?? 0) + 1 };
        // An approved claim outranks a rejected one whatever their order:
        // the row answers "has this bill been claimed, and did it stand".
        claims.set(key, !seen || RANK[e.status] >= RANK[seen.state] ? next : { ...seen, count: next.count });
      }
    }
  }

  const rows = orders
    .map((o) => {
      // Paid DENTISTE' lines only. A free gift is a DENTISTE' line worth
      // nothing once its discount is taken off, and counting it would add
      // pieces to the tally that nobody bought.
      const lines = o.lines.filter((l) => isDentisteVendor(l.vendor) && l.amount > 0);
      const claim = claims.get(normalizeOrderName(o.orderName) ?? "") ?? claims.get(o.orderId) ?? null;

      // What this bill would be worth if its buyer sent it in. Scored off the
      // whole order, not the DENTISTE' lines above: the rules classify by
      // variant, and the VIP set is a DENTISTE' line that earns nothing.
      const scored: LineItem[] = o.lines
        .filter((l) => l.variantId && l.quantity > 0 && l.amount > 0)
        .map((l) => ({ variantId: l.variantId as string, quantity: l.quantity, price: l.amount / l.quantity }));
      const amounts = amountsFromLineItems(scored, rules);
      const entries = computeEntries(amounts, rules);

      return {
        orderName: o.orderName,
        adminUrl: o.adminUrl,
        paidAt: o.processedAt,
        customer: o.customerName,
        email: o.customerEmail,
        amount: lines.reduce((sum, l) => sum + l.amount, 0),
        units: lines.reduce((sum, l) => sum + l.quantity, 0),
        orderTotal: o.total,
        items: lines.map((l) => ({ title: l.title, quantity: l.quantity, amount: l.amount })),
        // The two numbers the campaign cares about, beside the money: what
        // counts toward entries, and how many that comes to.
        eligible: amounts.dentisteAmount + amounts.keychainAmount,
        entries,
        receipt: claim ? { state: claim.state, at: claim.at, who: claim.who, count: claim.count } : null,
      };
    })
    // An order whose only DENTISTE' lines were gifts bought nothing here.
    .filter((r) => r.amount > 0);

  const claimed = rows.filter((r) => r.receipt).length;
  const earning = rows.filter((r) => r.entries > 0).length;

  return NextResponse.json({
    ok: true,
    since,
    campaign,
    orders: rows,
    totals: {
      orders: rows.length,
      units: rows.reduce((sum, r) => sum + r.units, 0),
      amount: rows.reduce((sum, r) => sum + r.amount, 0),
      claimed,
      unclaimed: rows.length - claimed,
      earning,
      /** Bills too small to be worth an entry — ฿690 is the step. */
      noEntry: rows.length - earning,
      entries: rows.reduce((sum, r) => sum + r.entries, 0),
      threshold: rules.generalThreshold,
    },
  });
}
