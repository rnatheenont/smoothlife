import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { FreeGiftPromoRow, rowToPromo } from "@/data/free-gifts";
import { getProductBySlug } from "@/data/products";
import { normaliseGifts } from "@/lib/free-gift-input";
import { campaignSettings } from "@/lib/free-gift-settings";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
  // The gift moved to the shop's free-gift shelf (see the create route); a
  // catalogue slug is only still accepted so an older promo can be edited
  // without its gift being rewritten out from under it.
  if (typeof body.giftProductSlug === "string" && body.giftProductSlug) {
    if (!getProductBySlug(body.giftProductSlug)) {
      return NextResponse.json({ ok: false, error: `ไม่พบสินค้าของแถม: ${body.giftProductSlug}` }, { status: 400 });
    }
    patch.gift_product_slug = body.giftProductSlug;
  }
  if (typeof body.giftQty === "number") patch.gift_qty = body.giftQty;
  if (typeof body.giftVariantId === "string" || body.giftVariantId === null) patch.gift_variant_id = body.giftVariantId;
  // A promo can hand over several things. The single-gift columns keep the
  // first of them so anything still reading the old shape sees something
  // sensible; giftsOf prefers the list wherever both exist.
  if (body.gifts !== undefined) {
    const promoGifts = normaliseGifts(body.gifts, "");
    if (promoGifts.ok === false) return NextResponse.json({ ok: false, error: promoGifts.error }, { status: 400 });
    patch.gifts = promoGifts.gifts;
    patch.gift_variant_id = promoGifts.gifts[0].variant_id ?? null;
    patch.gift_qty = promoGifts.gifts[0].qty ?? 1;
  }
  if (typeof body.starts === "string" || body.starts === null) patch.starts_at = body.starts || null;
  if (typeof body.expires === "string" || body.expires === null) patch.expires_at = body.expires || null;
  if (Array.isArray(body.tiers)) {
    type TierBody = {
      minSubtotal: number;
      giftVariantId?: string;
      giftQty?: number;
      gifts?: unknown;
      discountType?: "free" | "percentage" | "fixed";
      discountValue?: number;
      shopifyDiscountId?: string;
    };
    const rows = [];
    for (const [i, t] of (body.tiers as TierBody[]).entries()) {
      const level = normaliseGifts(
        t.gifts ?? (t.giftVariantId ? [{ variantId: t.giftVariantId, qty: t.giftQty ?? 1 }] : []),
        `ในระดับที่ ${i + 1}`,
      );
      if (level.ok === false) return NextResponse.json({ ok: false, error: level.error }, { status: 400 });
      rows.push({
        min_subtotal: t.minSubtotal,
        gift_product_slug: "",
        gift_variant_id: level.gifts[0].variant_id ?? null,
        gift_qty: level.gifts[0].qty ?? 1,
        gifts: level.gifts,
        discount_type: t.discountType ?? null,
        discount_value: t.discountValue ?? null,
        shopify_discount_id: t.shopifyDiscountId ?? null,
      });
    }
    patch.tiers = rows;
  }
  // The campaign settings always travel together — the form sends all of
  // them, and a half-applied set is a campaign nobody can reason about.
  if (body.triggerType !== undefined || body.giftChoice !== undefined || body.discountType !== undefined) {
    Object.assign(patch, campaignSettings(body));
  }
  patch.updated_at = new Date().toISOString();

  const [row] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${pgValue(params.id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบโปรโมชั่นนี้" }, { status: 404 });
  return NextResponse.json({ ok: true, promo: { id: row.id, ...rowToPromo(row) } });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const [row] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${pgValue(params.id)}&select=id,active`);
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบโปรโมชั่นนี้" }, { status: 404 });
  if (row.active) return NextResponse.json({ ok: false, error: "ปิดใช้งานก่อนลบ" }, { status: 400 });

  await supabaseRest(`free_gift_promos?id=eq.${pgValue(params.id)}`, { method: "DELETE", returning: false });
  return NextResponse.json({ ok: true });
}
