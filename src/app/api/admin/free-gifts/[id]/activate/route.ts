import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { FreeGiftPromoRow, rowToPromo } from "@/data/free-gifts";
import { getProductBySlug } from "@/data/products";
import {
  createBxgyFreeGiftDiscount,
  createSpendThresholdFreeGiftDiscount,
  shopifyAdminConfigured,
} from "@/lib/shopify-admin";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured() || !shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const [row] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${params.id}&select=*`);
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบโปรโมชั่นนี้" }, { status: 404 });
  if (row.active) return NextResponse.json({ ok: false, error: "โปรโมชั่นนี้เปิดใช้งานอยู่แล้ว" }, { status: 400 });

  if (row.kind === "tiered") {
    if (!row.tiers?.length) {
      return NextResponse.json({ ok: false, error: "ไม่มีข้อมูลระดับ (tiers)" }, { status: 400 });
    }
    const sortedTiers = [...row.tiers].sort((a, b) => a.min_subtotal - b.min_subtotal);
    const updatedTiers: typeof row.tiers = [];
    let cumulativeGiftVariantIds: string[] = [];
    try {
      for (const [i, tier] of sortedTiers.entries()) {
        const tierGift = getProductBySlug(tier.gift_product_slug);
        if (!tierGift) throw new Error(`ไม่พบสินค้าของแถม (ระดับ ${i + 1}): ${tier.gift_product_slug}`);
        cumulativeGiftVariantIds = [...cumulativeGiftVariantIds, ...tierGift.variants.map((v) => v.variantId)];
        const tierDiscountId = await createSpendThresholdFreeGiftDiscount({
          title: `${row.title_en} — tier ${i + 1}`,
          minSubtotal: tier.min_subtotal,
          giftVariantIds: cumulativeGiftVariantIds,
          giftQuantity: tier.gift_qty,
          endsAt: row.expires_at ?? undefined,
        });
        updatedTiers.push({ ...tier, shopify_discount_id: tierDiscountId });
      }
    } catch (err) {
      console.error("[admin/free-gifts/activate] tiered", err);
      return NextResponse.json({ ok: false, error: "สร้างส่วนลดใน Shopify ไม่สำเร็จ" }, { status: 502 });
    }
    const [updated] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: true, tiers: updatedTiers, updated_at: new Date().toISOString() }),
    });
    return NextResponse.json({ ok: true, promo: { id: updated.id, ...rowToPromo(updated) } });
  }

  const giftProduct = getProductBySlug(row.gift_product_slug);
  if (!giftProduct) {
    return NextResponse.json({ ok: false, error: `ไม่พบสินค้าของแถม: ${row.gift_product_slug}` }, { status: 400 });
  }
  const giftVariantIds = giftProduct.variants.map((v) => v.variantId);

  let discountId: string;
  try {
    if (row.kind === "bxgy") {
      if (!row.buy_product_slugs?.length || !row.buy_qty) {
        return NextResponse.json({ ok: false, error: "ข้อมูลสินค้าที่ต้องซื้อไม่ครบ" }, { status: 400 });
      }
      const buyProductVariantIds: string[] = [];
      for (const slug of row.buy_product_slugs) {
        const p = getProductBySlug(slug);
        if (!p) throw new Error(`ไม่พบสินค้า: ${slug}`);
        buyProductVariantIds.push(...p.variants.map((v) => v.variantId));
      }
      discountId = await createBxgyFreeGiftDiscount({
        title: row.title_en,
        buyProductVariantIds,
        buyQuantity: row.buy_qty,
        giftVariantIds,
        giftQuantity: row.gift_qty,
        endsAt: row.expires_at ?? undefined,
      });
    } else {
      if (!row.min_subtotal) {
        return NextResponse.json({ ok: false, error: "ข้อมูลยอดขั้นต่ำไม่ครบ" }, { status: 400 });
      }
      discountId = await createSpendThresholdFreeGiftDiscount({
        title: row.title_en,
        minSubtotal: row.min_subtotal,
        giftVariantIds,
        giftQuantity: row.gift_qty,
        endsAt: row.expires_at ?? undefined,
      });
    }
  } catch (err) {
    console.error("[admin/free-gifts/activate]", err);
    return NextResponse.json({ ok: false, error: "สร้างส่วนลดใน Shopify ไม่สำเร็จ" }, { status: 502 });
  }

  const [updated] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${params.id}`, {
    method: "PATCH",
    body: JSON.stringify({ active: true, shopify_discount_id: discountId, updated_at: new Date().toISOString() }),
  });
  return NextResponse.json({ ok: true, promo: { id: updated.id, ...rowToPromo(updated) } });
}
