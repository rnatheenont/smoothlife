import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { products } from "@/data/products";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

type SettingsRow = { product_slug: string; subscribable: boolean; bundle_eligible: boolean };

const PAGE_SIZE = 30;

// Browsable + filterable, not search-only: without a query the catalogue
// (~1000 products) is paginated alphabetically rather than showing nothing
// until the admin already knows a product's exact name (the old default
// only ever showed products someone had previously touched). `status`
// narrows to just the exceptions worth reviewing (excluded from
// subscriptions, or included in the bundle pool) instead of paging
// through everything.
export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const category = req.nextUrl.searchParams.get("category")?.trim() ?? "";
  const status = req.nextUrl.searchParams.get("status")?.trim() ?? "all"; // all | subscribable-off | bundle-on
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);

  const settingsRows = await supabaseRest<SettingsRow[]>(
    "product_subscription_settings?select=product_slug,subscribable,bundle_eligible"
  );
  const settingsBySlug = new Map(settingsRows.map((r) => [r.product_slug, r]));

  let matched = products.filter(
    (p) =>
      (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.slug.includes(q)) &&
      (!category || p.category === category)
  );

  const withSettings = matched.map((p) => {
    const settings = settingsBySlug.get(p.slug);
    return {
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      category: p.category,
      image: p.image,
      inStock: p.inStock,
      subscribable: settings ? settings.subscribable : false,
      bundleEligible: settings ? settings.bundle_eligible : false,
    };
  });

  const filtered =
    status === "subscribable-off"
      ? withSettings.filter((p) => !p.subscribable)
      : status === "bundle-on"
        ? withSettings.filter((p) => p.bundleEligible)
        : withSettings;

  filtered.sort((a, b) => a.name.localeCompare(b.name, "th"));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return NextResponse.json({ ok: true, products: rows, total, page: Math.min(page, totalPages), totalPages, pageSize: PAGE_SIZE });
}

export async function PATCH(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const { productSlug, productSlugs, subscribable, bundleEligible } = body ?? {};

  if (typeof subscribable !== "boolean" && typeof bundleEligible !== "boolean") {
    return NextResponse.json({ ok: false, error: "ไม่มีค่าที่จะบันทึก" }, { status: 400 });
  }

  // Bulk path: only one field at a time (mirrors the single-row toggle),
  // upserts via ON CONFLICT so untouched products (no settings row yet)
  // get created with the other field left at its column default rather
  // than needing an existing-row lookup per slug first.
  if (Array.isArray(productSlugs) && productSlugs.length > 0) {
    const field = typeof subscribable === "boolean" ? "subscribable" : "bundle_eligible";
    const value = typeof subscribable === "boolean" ? subscribable : bundleEligible;
    await supabaseRest("product_subscription_settings?on_conflict=product_slug", {
      method: "POST",
      returning: false,
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(
        productSlugs.map((slug: string) => ({ product_slug: slug, [field]: value, updated_at: new Date().toISOString() }))
      ),
    });
    return NextResponse.json({ ok: true, updated: productSlugs.length });
  }

  if (typeof productSlug !== "string" || !productSlug) {
    return NextResponse.json({ ok: false, error: "ไม่พบสินค้านี้" }, { status: 400 });
  }

  const [existing] = await supabaseRest<SettingsRow[]>(
    `product_subscription_settings?product_slug=eq.${encodeURIComponent(productSlug)}&select=product_slug,subscribable,bundle_eligible`
  );

  const next = {
    product_slug: productSlug,
    subscribable: typeof subscribable === "boolean" ? subscribable : existing?.subscribable ?? false,
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
