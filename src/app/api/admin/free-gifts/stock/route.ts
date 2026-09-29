import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { freeGiftProducts, shopifyAdminConfigured } from "@/lib/shopify-admin";

// What is left of the shop's free gifts.
//
// The gifts themselves are handed out by an app on Shopify's side, which this
// codebase cannot read. What it can read is the shelf: every product tagged
// free-gift, and how many of it remain. A campaign still promising a gift that
// ran out yesterday is the failure this answers, and nothing else in either
// system was watching for it.

export const dynamic = "force-dynamic";

/** Below this a gift is worth chasing before the next campaign leans on it. */
const LOW_STOCK = 10;

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่าการเชื่อมต่อ Shopify" }, { status: 503 });
  }

  const gifts = await freeGiftProducts();
  return NextResponse.json(
    {
      ok: true,
      lowStock: LOW_STOCK,
      totals: {
        all: gifts.length,
        out: gifts.filter((g) => g.stock <= 0).length,
        low: gifts.filter((g) => g.stock > 0 && g.stock < LOW_STOCK).length,
      },
      gifts,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
