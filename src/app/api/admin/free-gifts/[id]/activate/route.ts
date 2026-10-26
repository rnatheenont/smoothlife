import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { FreeGiftPromoRow, rowToPromo } from "@/data/free-gifts";

// Switching a promo on, and nothing else.
//
// It used to also create the matching automatic discount on Shopify, which
// bundled two decisions that are not the same one. Turning a promo on affects
// this site: the cart starts showing it and the checkout starts putting the
// gift on the orders it builds. Creating a Shopify discount affects the other
// shopfront — the theme on www — and is the shop's own live discount list.
//
// Since the checkout grants the gift itself (see lib/checkout-gifts.ts), the
// Shopify discount is not needed for anything here. Somebody who wants one for
// www asks for it on its own, through ./shopify-discount.

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const [row] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${pgValue(params.id)}&select=*`);
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบโปรโมชั่นนี้" }, { status: 404 });
  if (row.active) return NextResponse.json({ ok: false, error: "โปรโมชั่นนี้เปิดใช้งานอยู่แล้ว" }, { status: 400 });

  const [updated] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${pgValue(params.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ active: true, updated_at: new Date().toISOString() }),
  });
  return NextResponse.json({ ok: true, promo: { id: updated.id, ...rowToPromo(updated) } });
}
