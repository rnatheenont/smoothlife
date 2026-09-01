import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { products } from "@/data/products";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

type SettingsRow = { product_slug: string; subscribable: boolean; bundle_eligible: boolean };

// Never ships the full ~1000-product catalogue at once — with a search
// query, matches by name/brand/slug (capped); without one, shows only
// products someone has already flagged (subscribable=false or
// bundle_eligible=true — i.e. anything that's ever been touched), so the
// page loads to something useful without forcing a search first.
export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  const settingsRows = await supabaseRest<SettingsRow[]>(
    "product_subscription_settings?select=product_slug,subscribable,bundle_eligible"
  );
  const settingsBySlug = new Map(settingsRows.map((r) => [r.product_slug, r]));

  const matched = q
    ? products
        .filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.slug.includes(q))
        .slice(0, 50)
    : products.filter((p) => settingsBySlug.has(p.slug)).slice(0, 100);

  const rows = matched.map((p) => {
    const settings = settingsBySlug.get(p.slug);
    return {
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      image: p.image,
      inStock: p.inStock,
      subscribable: settings ? settings.subscribable : true,
      bundleEligible: settings ? settings.bundle_eligible : false,
    };
  });

  return NextResponse.json({ ok: true, products: rows });
}

export async function PATCH(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const { productSlug, subscribable, bundleEligible } = body ?? {};
  if (typeof productSlug !== "string" || !productSlug) {
    return NextResponse.json({ ok: false, error: "ไม่พบสินค้านี้" }, { status: 400 });
  }
  if (typeof subscribable !== "boolean" && typeof bundleEligible !== "boolean") {
    return NextResponse.json({ ok: false, error: "ไม่มีค่าที่จะบันทึก" }, { status: 400 });
  }

  const [existing] = await supabaseRest<SettingsRow[]>(
    `product_subscription_settings?product_slug=eq.${encodeURIComponent(productSlug)}&select=product_slug,subscribable,bundle_eligible`
  );

  const next = {
    product_slug: productSlug,
    subscribable: typeof subscribable === "boolean" ? subscribable : existing?.subscribable ?? true,
    bundle_eligible: typeof bundleEligible === "boolean" ? bundleEligible : existing?.bundle_eligible ?? false,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabaseRest(`product_subscription_settings?product_slug=eq.${encodeURIComponent(productSlug)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify(next),
    });
  } else {
    await supabaseRest("product_subscription_settings", {
      method: "POST",
      returning: false,
      body: JSON.stringify(next),
    });
  }

  return NextResponse.json({ ok: true, subscribable: next.subscribable, bundleEligible: next.bundle_eligible });
}
