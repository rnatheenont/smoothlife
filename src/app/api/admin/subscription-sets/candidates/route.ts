import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// What to offer before anyone types: the products the shop already marked as
// set material on the other two tabs. Out of 900 products those are the few
// dozen a set is actually built from.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, slugs: [] });

  const rows = await supabaseRest<{ product_slug: string }[]>(
    "product_subscription_settings?or=(bundle_eligible.eq.true,subscribable.eq.true)&select=product_slug&limit=500"
  ).catch((): { product_slug: string }[] => []);

  return NextResponse.json({ ok: true, slugs: [...new Set(rows.map((r) => r.product_slug))] });
}
