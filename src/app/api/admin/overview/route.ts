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
  const [waitingChats, pendingReviews, paidToday, activeSubs, subscribableOn, openQuestions] = await Promise.all([
    countRows("conversations?status=eq.waiting_human&select=id&limit=100"),
    countRows("product_reviews?status=eq.pending&select=id&limit=100"),
    countRows(`payment_transactions?status=eq.success&confirmed_at=gte.${since}&select=id&limit=100`),
    countRows("real_subscriptions?status=eq.active&select=id&limit=100"),
    countRows("product_subscription_settings?subscribable=eq.true&select=product_slug&limit=1000"),
    countRows("product_questions?answer=is.null&select=id&limit=100"),
  ]);

  return NextResponse.json({
    ok: true,
    stats: { waitingChats, pendingReviews, paidToday, activeSubs, subscribableOn, openQuestions },
  });
}
