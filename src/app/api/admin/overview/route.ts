import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

// Numbers for the admin home screen. Every one of these is something that
// either needs a person to act (a waiting chat, a review queue) or answers
// "is the shop working" (orders taken, subscriptions live) — a dashboard of
// vanity totals nobody acts on is just decoration on a menu.
//
// Counts come from PostgREST's exact-count header rather than fetching rows,
// so a table with thousands of rows costs the same as an empty one. Each is
// independent: one failing table must not blank the whole page.

/** A count the database works out for us (an rpc returning a number). */
async function countValue(path: string): Promise<number | null> {
  try {
    const value = await supabaseRest<number>(path, { method: "POST", body: "{}" });
    return typeof value === "number" ? value : null;
  } catch {
    return null;
  }
}

async function countRows(path: string): Promise<number | null> {
  try {
    const rows = await supabaseRest<{ id: string }[]>(path);
    return rows.length;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, stats: {} });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const since = todayStart.toISOString();

  // `limit` caps each read: the home screen only needs to say "9+" once a
  // queue is long, and nobody acts differently on 40 versus 400 waiting chats.
  const now = new Date().toISOString();

  const [
    waitingChats,
    pendingReviews,
    paidToday,
    activeSubs,
    subscribableOn,
    openQuestions,
    flashRunning,
    flashScheduled,
    flashOrdersFailed,
    refundsPending,
    kbDrafts,
    kbReviewDue,
  ] = await Promise.all([
    countRows("conversations?status=eq.waiting_human&select=id&limit=100"),
    countRows("product_reviews?status=eq.pending&select=id&limit=100"),
    countRows(`payment_transactions?status=eq.success&confirmed_at=gte.${since}&select=id&limit=100`),
    countRows("real_subscriptions?status=eq.active&select=id&limit=100"),
    countRows("product_subscription_settings?subscribable=eq.true&select=product_slug&limit=1000"),
    countRows("product_questions?answer=is.null&select=id&limit=100"),
    // Selling right now: started, not ended by hand, not past its end time.
    countRows(
      `flash_sale_campaigns?starts_at=lte.${now}&ended_manually_at=is.null&or=(ends_at.is.null,ends_at.gt.${now})&select=id&limit=100`
    ),
    countRows(`flash_sale_campaigns?starts_at=gt.${now}&ended_manually_at=is.null&select=id&limit=100`),
    // Paid, but the Shopify order never got created — someone has to retry it.
    countRows("flash_sale_queue?status=eq.paid&shopify_sync_status=eq.failed&select=id&limit=100"),
    // Charges flagged for a refund (late or duplicate flash-sale payments).
    countRows("payment_transactions?refund_note=like.FLASH_SALE_*&refunded_at=is.null&select=id&limit=100"),
    // Answers promoted from chat wait as drafts until a person publishes them.
    countRows("kb_articles?status=eq.draft&select=id&limit=100"),
    // Published articles a person wrote that are past their review date. The
    // intervals differ per category, so this one is counted in the database
    // (kb_review_due_count, which mirrors lib/kb-review.ts).
    countValue("rpc/kb_review_due_count"),
  ]);

  return NextResponse.json({
    ok: true,
    stats: {
      waitingChats,
      pendingReviews,
      paidToday,
      activeSubs,
      subscribableOn,
      openQuestions,
      flashRunning,
      flashScheduled,
      flashOrdersFailed,
      refundsPending,
      kbDrafts,
      kbReviewDue,
    },
  });
}
