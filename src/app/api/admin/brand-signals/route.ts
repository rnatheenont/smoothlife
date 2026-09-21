import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { syncOwnReviews, syncGoogleTrends, type BrandSignalInput } from "@/lib/brand-signals";

// Phase 1 only (see social-listening-seo-opportunity-plan.md): our own
// reviews + Google Trends. No paid social-listening tool wired in yet.
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const signals = await supabaseRest<BrandSignalInput[]>(
    "brand_signals?select=source,signal_type,sentiment,keyword,content,volume,occurred_at&order=occurred_at.desc&limit=500"
  );
  return NextResponse.json({ ok: true, signals });
}

// One combined "sync now" — both sources are cheap and idempotent (see
// recordSignals' upsert), so there is no reason to run them separately from
// the admin page.
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const [reviews, trendsResult] = await Promise.allSettled([syncOwnReviews(), syncGoogleTrends()]);

  return NextResponse.json({
    ok: true,
    ownReviews: reviews.status === "fulfilled" ? reviews.value : { error: String(reviews.reason) },
    googleTrends: trendsResult.status === "fulfilled" ? trendsResult.value : { error: String(trendsResult.reason) },
  });
}
