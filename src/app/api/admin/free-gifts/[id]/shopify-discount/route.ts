import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { FreeGiftPromoRow, rowToPromo } from "@/data/free-gifts";
import { getProductBySlug } from "@/data/products";
import {
  createBxgyFreeGiftDiscount,
  createSpendThresholdFreeGiftDiscount,
  shopifyAdminConfigured,
} from "@/lib/shopify-admin";

// Giving this promo a real automatic discount on Shopify.
//
// Its own action because it is its own decision, and it is the one that
// reaches outside: an automatic discount appears in the shop's discount list
// and applies to www, the Shopify theme. This site does not need it — the
// checkout here puts the gift on the orders it builds (lib/checkout-gifts.ts)
// — so this exists for the other shopfront, and only when somebody asks.
//
// Nothing here switches the promo on. A promo can run on this site with no
// discount on Shopify, and a discount can exist for a promo that is off.

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured() || !shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const [row] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${pgValue(params.id)}&select=*`);
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบโปรโมชั่นนี้" }, { status: 404 });

  // A promo the app on Shopify's side already hands out does not get a second
  // mechanism pointed at the same cart.
  if (row.display_only !== false) {
    return NextResponse.json(
      { ok: false, error: "โปรนี้ตั้งเป็นแบบแสดงผลอย่างเดียว — แอปฝั่ง Shopify เป็นคนแจกอยู่แล้ว" },
      { status: 400 },
    );
  }

  if (row.kind === "tiered") {
    if (!row.tiers?.length) {
      return NextResponse.json({ ok: false, error: "ไม่มีข้อมูลระดับ (tiers)" }, { status: 400 });
    }
    if (row.tiers.every((t) => t.shopify_discount_id)) {
      return NextResponse.json({ ok: false, error: "สร้างส่วนลดให้โปรนี้ไปแล้ว" }, { status: 400 });
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
      console.error("[admin/free-gifts/shopify-discount] tiered", err);
      return NextResponse.json({ ok: false, error: "สร้างส่วนลดใน Shopify ไม่สำเร็จ" }, { status: 502 });
    }
    const [updated] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${pgValue(params.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ tiers: updatedTiers, updated_at: new Date().toISOString() }),
    });
    return NextResponse.json({ ok: true, promo: { id: updated.id, ...rowToPromo(updated) } });
  }

  if (row.shopify_discount_id) {
    return NextResponse.json({ ok: false, error: "สร้างส่วนลดให้โปรนี้ไปแล้ว" }, { status: 400 });
  }

  const giftProduct = getProductBySlug(row.gift_product_slug);
  if (!giftProduct) {
    return NextResponse.json(
      { ok: false, error: `ไม่พบสินค้าของแถมในแคตตาล็อก: ${row.gift_product_slug || "(ว่าง)"}` },
      { status: 400 },
    );
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
    console.error("[admin/free-gifts/shopify-discount]", err);
    return NextResponse.json({ ok: false, error: "สร้างส่วนลดใน Shopify ไม่สำเร็จ" }, { status: 502 });
  }

  const [updated] = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?id=eq.${pgValue(params.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ shopify_discount_id: discountId, updated_at: new Date().toISOString() }),
  });
  return NextResponse.json({ ok: true, promo: { id: updated.id, ...rowToPromo(updated) } });
}
