import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { FreeGiftPromoRow, rowToPromo } from "@/data/free-gifts";
import { getProductBySlug } from "@/data/products";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  if (body.active === true) {
    return NextResponse.json({ ok: false, error: "ใช้ปุ่มเปิดใช้งานเพื่อสร้างส่วนลดจริงใน Shopify" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.active === false) patch.active = false;
  if (typeof body.titleTh === "string") patch.title_th = body.titleTh;
  if (typeof body.titleEn === "string") patch.title_en = body.titleEn;
  if (Array.isArray(body.buyProductSlugs)) {
    for (const s of body.buyProductSlugs) {
      if (!getProductBySlug(s)) return NextResponse.json({ ok: false, error: `ไม่พบสินค้า: ${s}` }, { status: 400 });
    }
    patch.buy_product_slugs = body.buyProductSlugs;
  }
  if (typeof body.buyQty === "number") patch.buy_qty = body.buyQty;
  if (typeof body.minSubtotal === "number") patch.min_subtotal = body.minSubtotal;
  if (typeof body.giftProductSlug === "string") {
    if (!getProductBySlug(body.giftProductSlug)) {
      return NextResponse.json({ ok: false, error: `ไม่พบสินค้าของแถม: ${body.giftProductSlug}` }, { status: 400 });
    }
    patch.gift_product_slug = body.giftProductSlug;
  }
  if (typeof body.giftQty === "number") patch.gift_qty = body.giftQty;
  if (typeof body.expires === "string" || body.expires === null) patch.expires_at = body.expires;
  if (Array.isArray(body.tiers)) {
    for (const t of body.tiers) {
      if (!t.giftProductSlug || !getProductBySlug(t.giftProductSlug)) {
        return NextResponse.json({ ok: false, error: `ไม่พบสินค้าของแถม: ${t.giftProductSlug}` }, { status: 400 });
      }
    }
    patch.tiers = body.tiers.map((t: { minSubtotal: number; giftProductSlug: string; giftQty: number; shopifyDiscountId?: string }) => ({
      min_subtotal: t.minSubtotal,
      gift_product_slug: t.giftProductSlug,
      gift_qty: t.giftQty && t.giftQty > 0 ? t.giftQty : 1,
      shopify_discount_id: t.shopifyDiscountId ?? null,
    }));
  }
  patch.updated_at = new Date().toISOString();

  const [row] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${pgValue(params.id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบโปรโมชั่นนี้" }, { status: 404 });
  return NextResponse.json({ ok: true, promo: { id: row.id, ...rowToPromo(row) } });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const [row] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${pgValue(params.id)}&select=id,active`);
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบโปรโมชั่นนี้" }, { status: 404 });
  if (row.active) return NextResponse.json({ ok: false, error: "ปิดใช้งานก่อนลบ" }, { status: 400 });

  await supabaseRest(`free_gift_promos?id=eq.${pgValue(params.id)}`, { method: "DELETE", returning: false });
  return NextResponse.json({ ok: true });
}
