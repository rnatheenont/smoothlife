import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { FreeGiftPromoRow, rowToPromo, FREE_GIFT_COLUMNS } from "@/data/free-gifts";
import { getProductBySlug } from "@/data/products";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const rows = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?select=${FREE_GIFT_COLUMNS}&order=created_at.desc`);
  return NextResponse.json({ ok: true, promos: rows.map((r) => ({ id: r.id, ...rowToPromo(r) })) });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const { slug, titleTh, titleEn, kind, buyProductSlugs, buyQty, minSubtotal, giftProductSlug, giftVariantId, giftQty, starts, expires, tiers } = body;

  if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ ok: false, error: "slug ต้องเป็นตัวพิมพ์เล็ก a-z 0-9 และ - เท่านั้น" }, { status: 400 });
  }
  if (!titleTh || !titleEn) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อโปรโมชั่นทั้งไทยและอังกฤษ" }, { status: 400 });
  }
  if (kind !== "bxgy" && kind !== "spend" && kind !== "tiered") {
    return NextResponse.json({ ok: false, error: "kind ต้องเป็น bxgy, spend หรือ tiered" }, { status: 400 });
  }
  if (kind === "bxgy") {
    if (!Array.isArray(buyProductSlugs) || buyProductSlugs.length === 0 || !buyQty || buyQty <= 0) {
      return NextResponse.json({ ok: false, error: "กรุณาระบุสินค้าที่ต้องซื้อและจำนวน" }, { status: 400 });
    }
    for (const s of buyProductSlugs) {
      if (!getProductBySlug(s)) return NextResponse.json({ ok: false, error: `ไม่พบสินค้า: ${s}` }, { status: 400 });
    }
    // The gift is a variant on the shop's free-gift shelf, not a catalogue
    // slug: every gift product is UNLISTED in Shopify and none of them is in
    // the catalogue this route used to check against.
    if (typeof giftVariantId !== "string" || !giftVariantId.startsWith("gid://shopify/ProductVariant/")) {
      return NextResponse.json({ ok: false, error: "กรุณาเลือกของแถมจากรายการของแถมใน Shopify" }, { status: 400 });
    }
  } else if (kind === "spend") {
    if (!minSubtotal || minSubtotal <= 0) {
      return NextResponse.json({ ok: false, error: "กรุณาระบุยอดขั้นต่ำ" }, { status: 400 });
    }
    // The gift is a variant on the shop's free-gift shelf, not a catalogue
    // slug: every gift product is UNLISTED in Shopify and none of them is in
    // the catalogue this route used to check against.
    if (typeof giftVariantId !== "string" || !giftVariantId.startsWith("gid://shopify/ProductVariant/")) {
      return NextResponse.json({ ok: false, error: "กรุณาเลือกของแถมจากรายการของแถมใน Shopify" }, { status: 400 });
    }
  } else {
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return NextResponse.json({ ok: false, error: "กรุณาระบุอย่างน้อย 1 ระดับ" }, { status: 400 });
    }
    for (const t of tiers) {
      if (!t.minSubtotal || t.minSubtotal <= 0) {
        return NextResponse.json({ ok: false, error: "กรุณาระบุยอดขั้นต่ำของแต่ละระดับ" }, { status: 400 });
      }
      if (typeof t.giftVariantId !== "string" || !t.giftVariantId.startsWith("gid://shopify/ProductVariant/")) {
        return NextResponse.json({ ok: false, error: "กรุณาเลือกของแถมของทุกระดับจากรายการของแถมใน Shopify" }, { status: 400 });
      }
    }
  }

  try {
    const [row] = await supabaseRest<FreeGiftPromoRow[]>("free_gift_promos", {
      method: "POST",
      body: JSON.stringify({
        slug,
        active: false,
        title_th: titleTh,
        title_en: titleEn,
        kind,
        buy_product_slugs: kind === "bxgy" ? buyProductSlugs : null,
        buy_qty: kind === "bxgy" ? buyQty : null,
        min_subtotal: kind === "spend" ? minSubtotal : null,
        // The gift now comes from the shop's free-gift shelf, which is not in
        // our catalogue, so the slug is whatever the older form left behind and
        // the variant is the one that means anything.
        gift_product_slug: kind === "tiered" ? "" : (giftProductSlug ?? ""),
        gift_variant_id: kind === "tiered" ? null : (giftVariantId ?? null),
        gift_qty: kind === "tiered" ? 1 : giftQty && giftQty > 0 ? giftQty : 1,
        tiers:
          kind === "tiered"
            ? tiers.map((t: { minSubtotal: number; giftProductSlug?: string; giftVariantId?: string; giftQty: number }) => ({
                min_subtotal: t.minSubtotal,
                gift_product_slug: t.giftProductSlug ?? "",
                gift_variant_id: t.giftVariantId ?? null,
                gift_qty: t.giftQty && t.giftQty > 0 ? t.giftQty : 1,
                shopify_discount_id: null,
              }))
            : null,
        shopify_discount_id: null,
        starts_at: starts || null,
        expires_at: expires || null,
      }),
    });
    return NextResponse.json({ ok: true, promo: { id: row.id, ...rowToPromo(row) } }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("23505")) {
      return NextResponse.json({ ok: false, error: "slug นี้ถูกใช้แล้ว" }, { status: 409 });
    }
    console.error("[admin/free-gifts] create failed", err);
    return NextResponse.json({ ok: false, error: "สร้างโปรโมชั่นไม่สำเร็จ" }, { status: 500 });
  }
}
