import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { flashSaleStatus, UUID_RE, type FlashSaleStatus } from "@/lib/flash-sale";
import { variantsSoldSince } from "@/lib/shopify-admin";
import { linePushConfigured } from "@/lib/line-push";

// The sale page polls this: campaign phase, each product's stock and, for a
// signed-in shopper, their own place in line. Reading it also settles overdue
// reservations (lazy expiry), so the numbers are current.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  try {
    const status = await flashSaleStatus(id, userId);
    if (!status) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });

    // "ขายแล้ว" means sold, not "sold through this queue". A campaign of
    // twenty-five sets is twenty-five whichever door they leave by, and two
    // of these went out of the shop's own front door four minutes after the
    // sale opened while the page still read zero. The queue's number is the
    // floor; Shopify's is the truth when it is higher.
    await countStorefrontSales(id, status);
    // A charge that came in after the shopper's slot was gone: say so plainly
    // rather than leave them wondering where the money went.
    let refundPending = false;
    if (userId) {
      const flagged = await supabaseRest<{ id: string }[]>(
        `payment_transactions?user_id=eq.${pgValue(userId)}&refund_note=like.FLASH_SALE_*&status=eq.success&select=id,flash_sale_queue!inner(campaign_id)&flash_sale_queue.campaign_id=eq.${pgValue(id)}&limit=1`
      ).catch(() => []);
      refundPending = flagged.length > 0;
    }
    // Whether we can reach this shopper when their turn comes — the page says
    // so while they wait, and offers to link LINE when we cannot.
    let lineLinked = false;
    if (userId && linePushConfigured()) {
      const [identity] = await supabaseRest<{ provider_uid: string }[]>(
        `auth_identities?user_id=eq.${pgValue(userId)}&provider=eq.line&select=provider_uid&limit=1`
      ).catch((): { provider_uid: string }[] => []);
      lineLinked = Boolean(identity);
    }

    return NextResponse.json(
      { ok: true, signedIn: Boolean(userId), refundPending, lineNotify: linePushConfigured(), lineLinked, ...status },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[flash-sale] status failed", err);
    return NextResponse.json({ ok: false, error: "โหลดข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

/**
 * Raises each product's sold count to what Shopify says has actually been
 * bought since the sale opened.
 *
 * Never lowers it: an order our own checkout has just taken may not have
 * reached Shopify yet, and a number that goes backwards on the page is worse
 * than one that is briefly low. Fails quietly — the queue's own count stands
 * rather than the page failing to load in the middle of a drop.
 */
async function countStorefrontSales(campaignId: string, status: FlashSaleStatus): Promise<void> {
  try {
    const rows = await supabaseRest<{ product_slug: string; variant_id: string | null }[]>(
      `flash_sales?campaign_id=eq.${pgValue(campaignId)}&select=product_slug,variant_id`
    );
    const sold = await variantsSoldSince(
      rows.map((r) => r.variant_id),
      status.campaign.starts_at
    );
    if (!sold.size) return;

    const variantOf = new Map(rows.map((r) => [r.product_slug, r.variant_id]));
    for (const product of status.products) {
      const variant = variantOf.get(product.slug);
      const shopify = variant ? (sold.get(variant) ?? 0) : 0;
      if (shopify > product.sold) product.sold = Math.min(shopify, product.total);
    }
  } catch (err) {
    console.error("[flash-sale] storefront sales count failed", err);
  }
}
