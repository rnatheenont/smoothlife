import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { createFlashSaleCampaign } from "@/lib/flash-sale";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { CAMPAIGN_COLUMNS, parseCampaignInput, rowToCampaign, variantIdOf, type FlashSaleCampaignRow } from "@/lib/flash-sale-campaigns";
import { unpublishedIndex } from "@/lib/flash-sale-catalogue";

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
  const rows = await supabaseRest<FlashSaleCampaignRow[]>(`flash_sale_campaigns?select=${CAMPAIGN_COLUMNS}&is_demo=is.false&order=starts_at.asc&limit=200`);

  // Who has queued, per campaign. The list needs it to stop offering a delete
  // the database will refuse: flash_sale_queue references the campaign with ON
  // DELETE RESTRICT, so once anyone has queued its history has to stay — and
  // "ลบ" that always fails looks like a broken button rather than a rule.
  const queued = await supabaseRest<{ campaign_id: string }[]>(
    `flash_sale_queue?select=campaign_id&limit=20000`
  ).catch(() => [] as { campaign_id: string }[]);
  const queueRows = new Map<string, number>();
  for (const q of queued) queueRows.set(q.campaign_id, (queueRows.get(q.campaign_id) ?? 0) + 1);

  return NextResponse.json({
    ok: true,
    campaigns: rows.map((r) => ({ ...rowToCampaign(r), queueRows: queueRows.get(r.id) ?? 0 })),
    serverNow: Date.now(),
  });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return unavailable();
  // Drafts included: a campaign set up before its product goes live still has
  // to name a real variant, and Shopify is what says so — not the form.
  const extra = await unpublishedIndex();
  const parsed = parseCampaignInput(await req.json().catch(() => null), extra);
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    // One transaction: the campaign plus a stock row per product (fs_create_campaign).
    const r = parsed.row;
    const id = await createFlashSaleCampaign({
      ...r,
      products: r.product_slugs.map((slug) => ({
        slug,
        variant_id: variantIdOf(slug, extra),
        sale_price: parsed.salePrices[slug],
      })),
    });
    const [row] = await supabaseRest<FlashSaleCampaignRow[]>(`flash_sale_campaigns?id=eq.${pgValue(id)}&select=${CAMPAIGN_COLUMNS}`);
    return NextResponse.json({ ok: true, campaign: rowToCampaign(row) });
  } catch (err) {
    console.error("[admin/flash-sale] create failed", err);
    return NextResponse.json({ ok: false, error: "บันทึกแคมเปญไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
