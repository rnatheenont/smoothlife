import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { flashSaleMonitor, UUID_RE } from "@/lib/flash-sale";
import { sharedSourcesFor } from "@/lib/flash-sale-sources";

// Admin: live numbers for several campaigns in one request. The console can
// have any number of campaign queues unfolded at once, and each one polling
// for itself meant a round trip per campaign every few seconds — this is the
// same data, once per cycle. (The single-campaign route stays for anything
// that only needs one.)
export const dynamic = "force-dynamic";

const MAX_CAMPAIGNS = 12;

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").filter((id) => UUID_RE.test(id)))].slice(0, MAX_CAMPAIGNS);
  if (ids.length === 0) return NextResponse.json({ ok: true, monitors: {} }, { headers: { "Cache-Control": "no-store" } });

  try {
    // Charges to refund by hand (late or duplicate), for every campaign asked
    // about at once, then split per campaign below.
    const refundRows = await supabaseRest<
      { invoice_no: string; amount: number; refund_note: string; flash_sale_queue: { campaign_id: string } }[]
    >(
      `payment_transactions?refund_note=like.FLASH_SALE_*&status=eq.success&select=invoice_no,amount,refund_note,flash_sale_queue!inner(campaign_id)&flash_sale_queue.campaign_id=in.(${ids
        .map(pgValue)
        .join(",")})&order=confirmed_at.desc&limit=200`
    ).catch(() => []);

    const shared = await sharedSourcesFor(ids);

    const entries = await Promise.all(
      ids.map(async (id) => {
        const monitor = await flashSaleMonitor(id).catch(() => null);
        if (!monitor) return [id, null] as const;
        const refunds = refundRows
          .filter((r) => r.flash_sale_queue?.campaign_id === id)
          .map(({ invoice_no, amount, refund_note }) => ({ invoice_no, amount, refund_note }));
        return [id, { ...monitor, refunds, sharedSources: shared[id] ?? [] }] as const;
      })
    );

    return NextResponse.json(
      { ok: true, monitors: Object.fromEntries(entries.filter(([, value]) => value !== null)) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[admin/flash-sale] batch monitor failed", err);
    return NextResponse.json({ ok: false, error: "โหลดข้อมูลคิวไม่สำเร็จ" }, { status: 500 });
  }
}
