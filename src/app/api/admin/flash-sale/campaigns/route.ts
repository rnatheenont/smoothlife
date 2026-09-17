import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { createFlashSaleCampaign } from "@/lib/flash-sale";
import { getProductBySlug } from "@/data/products";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { CAMPAIGN_COLUMNS, parseCampaignInput, rowToCampaign, type FlashSaleCampaignRow } from "@/lib/flash-sale-campaigns";

// Admin: the flash-sale campaign list (GET) and adding a campaign (POST).

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}
function unavailable() {
  return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return unavailable();
  const rows = await supabaseRest<FlashSaleCampaignRow[]>(`flash_sale_campaigns?select=${CAMPAIGN_COLUMNS}&order=starts_at.asc&limit=200`);
  return NextResponse.json({ ok: true, campaigns: rows.map(rowToCampaign), serverNow: Date.now() });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return unavailable();
  const parsed = parseCampaignInput(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    // One transaction: the campaign plus a stock row per product (fs_create_campaign).
    const r = parsed.row;
    const id = await createFlashSaleCampaign({
      ...r,
      products: r.product_slugs.map((slug) => ({ slug, variant_id: getProductBySlug(slug)?.variantId ?? null })),
    });
    const [row] = await supabaseRest<FlashSaleCampaignRow[]>(`flash_sale_campaigns?id=eq.${pgValue(id)}&select=${CAMPAIGN_COLUMNS}`);
    return NextResponse.json({ ok: true, campaign: rowToCampaign(row) });
  } catch (err) {
    console.error("[admin/flash-sale] create failed", err);
    return NextResponse.json({ ok: false, error: "บันทึกแคมเปญไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
