import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { syncOwnReviews, syncCustomerVoice, syncGoogleTrends, getTrendTargets, type BrandSignalInput } from "@/lib/brand-signals";

// Phase 1 only (see social-listening-seo-opportunity-plan.md): our own
// reviews + Google Trends. No paid social-listening tool wired in yet.
export const dynamic = "force-dynamic";
// Trends answers in its own time and sometimes not at all, so each request
// takes a slice of the keyword list and says where to continue. 60s is this
// plan's ceiling; a run that needs more than one request is normal here
// rather than a failure, and every write is an upsert, so a slice repeated
// after a dropped connection costs nothing.
export const maxDuration = 60;
const BATCH = 5;

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

  const targets = getTrendTargets();
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);
  const slice = targets.slice(offset, offset + BATCH);

  // Reviews are one query and belong to the first request of a run, not to
  // every slice of it.
  const [reviews, voice, trendsResult] = await Promise.allSettled([
    offset === 0 ? syncOwnReviews() : Promise.resolve({ synced: 0 }),
    offset === 0 ? syncCustomerVoice() : Promise.resolve({ messages: 0, escalations: 0 }),
    syncGoogleTrends(slice),
  ]);

  const nextOffset = offset + BATCH < targets.length ? offset + BATCH : null;

  return NextResponse.json({
    ok: true,
    ownReviews: reviews.status === "fulfilled" ? reviews.value : { error: String(reviews.reason) },
    customerVoice: voice.status === "fulfilled" ? voice.value : { error: String(voice.reason) },
    googleTrends: trendsResult.status === "fulfilled" ? trendsResult.value : { error: String(trendsResult.reason) },
    offset,
    nextOffset,
    total: targets.length,
  });
}
