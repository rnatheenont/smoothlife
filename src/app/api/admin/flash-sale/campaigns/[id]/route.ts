import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { CAMPAIGN_COLUMNS, parseCampaignInput, rowToCampaign, variantIdOf, type FlashSaleCampaignRow } from "@/lib/flash-sale-campaigns";
import { unpublishedIndex } from "@/lib/flash-sale-catalogue";
import { updateFlashSaleCampaign } from "@/lib/flash-sale";

// Admin: act on one campaign.
//   PATCH { action: "update", ...campaign }
//                                 — edit it; how much may change depends on
//                                   whether it has opened (fs_update_campaign)
//   PATCH { action: "start_now" } — move starts_at to now (not once it has ended)
//   PATCH { action: "end_now" }   — stamp ended_manually_at (a campaign ended
//                                   before its start is simply cancelled)
//   PATCH { action: "reopen", endsAt? }
//                                 — clear the manual end and put a closing
//                                   time back in the future (or none at all)
//   PATCH { action: "publish", published }
//                                 — whether the sale page answers customers
//   DELETE                        — remove it
// The conditions are part of each write's filter, so a second click, or a
// click on a campaign someone else already ended, changes nothing.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { id } = await props.params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const now = new Date().toISOString();

  if (body?.action === "update") {
    const extra = await unpublishedIndex();
    const parsed = parseCampaignInput(body, extra);
    if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    const r = parsed.row;
    const result = await updateFlashSaleCampaign({
      ...r,
      id,
      products: r.product_slugs.map((slug) => ({
        slug,
        variant_id: variantIdOf(slug, extra),
        sale_price: parsed.salePrices[slug],
      })),
    });
    // strict: false — narrow the union by the key that only the failure has.
    if ("error" in result) {
      const missing = result.error === "not_found";
      return NextResponse.json(
        { ok: false, error: missing ? "ไม่พบแคมเปญ" : "เวลาปิดการขายต้องหลังเวลาเริ่มขาย" },
        { status: missing ? 404 : 400 }
      );
    }
    const [row] = await supabaseRest<FlashSaleCampaignRow[]>(`flash_sale_campaigns?id=eq.${pgValue(id)}&select=${CAMPAIGN_COLUMNS}`);
    return NextResponse.json({ ok: true, campaign: rowToCampaign(row), scope: result.scope });
  }

  let filter: string;
  let patch: Record<string, string | boolean | null>;
  if (body?.action === "publish") {
    filter = `id=eq.${pgValue(id)}`;
    patch = { published: body?.published === true };
  } else if (body?.action === "reopen") {
    // Selling again means two things stop being true: somebody ended it, and
    // its closing time is in the past. Both are undone here; the stock that
    // has already sold is not, which is why the screen says so before asking.
    const endsAt = typeof body?.endsAt === "number" && Number.isFinite(body.endsAt) ? new Date(body.endsAt) : null;
    if (endsAt && endsAt.getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, error: "เวลาปิดการขายต้องอยู่ในอนาคต" }, { status: 400 });
    }
    filter = `id=eq.${pgValue(id)}`;
    patch = { ended_manually_at: null, ends_at: endsAt ? endsAt.toISOString() : null };
  } else if (body?.action === "start_now") {
    // ends_at must still be ahead, or the new start would fall after the end.
    filter = `id=eq.${pgValue(id)}&ended_manually_at=is.null&or=(ends_at.is.null,ends_at.gt.${pgValue(now)})`;
    patch = { starts_at: now };
  } else if (body?.action === "end_now") {
    filter = `id=eq.${pgValue(id)}&ended_manually_at=is.null`;
    patch = { ended_manually_at: now };
  } else {
    return NextResponse.json({ ok: false, error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  }

  const rows = await supabaseRest<FlashSaleCampaignRow[]>(`flash_sale_campaigns?${filter}&select=${CAMPAIGN_COLUMNS}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "สถานะแคมเปญเปลี่ยนไปแล้ว รีเฟรชหน้าเพื่อดูล่าสุด" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, campaign: rowToCampaign(rows[0]) });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { id } = await props.params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  // Everyone still in the queue is turned out with the campaign: their slot
  // is a place in a sale that is about to stop existing, so keeping the row
  // preserves nothing.
  //
  // Anyone who paid is a different matter. That row is the only thing tying a
  // real Shopify order to the sale it came from, and no amount of tidying the
  // console is worth losing it — so the delete stops, says how many, and the
  // order has to be dealt with in Shopify first.
  const paid = await supabaseRest<{ id: string }[]>(
    `flash_sale_queue?campaign_id=eq.${pgValue(id)}&or=(paid_at.not.is.null,shopify_order_id.not.is.null)&select=id&limit=50`
  ).catch(() => [] as { id: string }[]);
  if (paid.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `ลบไม่ได้ — แคมเปญนี้มีคำสั่งซื้อที่ชำระเงินแล้ว ${paid.length} รายการผูกอยู่ ` +
          `ถ้าต้องการเอาหน้าขายลง ให้ใช้ “ปิดเผยแพร่” แทน`,
      },
      { status: 409 }
    );
  }

  const evicted = await supabaseRest<{ id: string }[]>(
    `flash_sale_queue?campaign_id=eq.${pgValue(id)}&select=id`,
    { method: "DELETE" }
  ).catch(() => [] as { id: string }[]);

  let rows: { id: string }[];
  try {
    rows = await supabaseRest<{ id: string }[]>(`flash_sale_campaigns?id=eq.${pgValue(id)}&select=id`, {
      method: "DELETE",
    });
  } catch (err) {
    // Something else still references it — the stock rows go with the
    // campaign, so this is a case worth seeing rather than guessing at.
    if (String(err).includes("23503")) {
      return NextResponse.json(
        { ok: false, error: "ลบไม่ได้ เพราะยังมีข้อมูลอื่นผูกอยู่กับแคมเปญนี้ ใช้ปิดเผยแพร่แทน" },
        { status: 409 }
      );
    }
    throw err;
  }
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ อาจถูกลบไปแล้ว" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, evicted: evicted.length });
}
