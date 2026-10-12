import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { getBrand } from "@/data/brands";
import { brandProfileSchema } from "@/lib/brand-profiles";

// Parking the brand profile form so the preview can draw it.
//
// Its own route for the same reason the review request has one: every write
// to /api/admin/brands requires pages.publish, and the person who most needs
// to see a brand page before it is live is the person who cannot publish it.
// Gated on pages.edit instead (see admin-route-permissions).
//
// It writes one jsonb column that nothing public reads, so this is the
// opposite of publishing — which is the whole point of it.
//
// profileIssues is deliberately not applied: a picture without a description
// fails a real save, and a half-filled profile is exactly what somebody wants
// to look at before deciding what to fix.

export async function PUT(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { slug?: string; profile?: unknown } | null;
  const brand = body?.slug ? getBrand(body.slug) : null;
  if (!brand) return NextResponse.json({ ok: false, error: "ไม่พบแบรนด์นี้" }, { status: 404 });

  const parsed = brandProfileSchema.safeParse(body?.profile);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "ข้อมูลไม่ครบหรือยาวเกินกำหนด" }, { status: 400 });
  }

  await supabaseRest("brand_profiles?on_conflict=slug", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      slug: brand.slug,
      draft: parsed.data,
      draft_at: new Date().toISOString(),
      // Recorded so a row that exists only because somebody previewed does
      // not look like a profile nobody filled in.
      updated_by: getAdminSession(token)?.userId ?? "shared-login",
    }),
  });

  return NextResponse.json({ ok: true });
}
