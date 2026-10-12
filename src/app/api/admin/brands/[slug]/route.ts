import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { getBrand, brandProducts } from "@/data/brands";
import {
  BRAND_PROFILE_COLUMNS,
  brandProfileSchema,
  brandProfileTag,
  profileIssues,
  type BrandProfile,
} from "@/lib/brand-profiles";
import { pageTag } from "@/lib/pages/store";
import { PAGES_BRAND_ENABLED } from "@/lib/feature-flags";

// One brand's profile, and the switch back to the automatic page.
//
// GET  — the profile (or an empty one), the brand's products to choose the
//        featured ones from, and whether a hand-laid page exists.
// PUT  — save the profile. Goes live on the next request: the profile is read
//        by the automatic page and by a hand-laid one alike, and there is no
//        draft of it, so the save route is gated on the publish permission.
// POST — { action: "use-auto" } stops showing the hand-laid page and puts the
//        automatic one back. The page row and its versions are kept, so the
//        team can return to it from the pages list.

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

async function brandOf(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  return getBrand(slug) ?? null;
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  const brand = await brandOf(props);
  if (!brand) return NextResponse.json({ ok: false, error: "ไม่พบแบรนด์นี้" }, { status: 404 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const [[profile], [page]] = await Promise.all([
    supabaseRest<BrandProfile[]>(`brand_profiles?select=${BRAND_PROFILE_COLUMNS}&slug=eq.${pgValue(brand.slug)}&limit=1`),
    supabaseRest<{ status: string }[]>(`pages?select=status&kind=eq.brand&slug=eq.${pgValue(brand.slug)}&limit=1`),
  ]);

  return NextResponse.json({
    ok: true,
    brand: { slug: brand.slug, name: brand.name, logo: brand.image, tagline: brand.tagline },
    profile: profile ?? null,
    // In stock first: the picker is for choosing what to put at the top of
    // the page, and a sold-out product would be skipped there anyway.
    products: brandProducts(brand)
      .map((p) => ({ slug: p.slug, name: p.name, image: p.image, inStock: p.inStock, reviewCount: p.reviewCount }))
      .sort((a, b) => Number(b.inStock) - Number(a.inStock) || b.reviewCount - a.reviewCount),
    page: page ?? null,
    liveOnSite: PAGES_BRAND_ENABLED,
  });
}

export async function PUT(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  const brand = await brandOf(props);
  if (!brand) return NextResponse.json({ ok: false, error: "ไม่พบแบรนด์นี้" }, { status: 404 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const parsed = brandProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "ข้อมูลไม่ครบหรือยาวเกินกำหนด" }, { status: 400 });
  }
  const profile = parsed.data;
  const issues = profileIssues(profile);
  if (issues.length) return NextResponse.json({ ok: false, error: issues.join(" · "), issues }, { status: 400 });

  // Only this brand's own products can be featured on its page.
  const own = new Set(brandProducts(brand).map((p) => p.slug));
  const featured = profile.featured_slugs.filter((slug) => own.has(slug));

  const actor = getAdminSession(token)?.userId ?? "shared-login";
  await supabaseRest("brand_profiles?on_conflict=slug", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      slug: brand.slug,
      ...profile,
      featured_slugs: featured,
      updated_by: actor,
      updated_at: new Date().toISOString(),
    }),
  });

  revalidateTag(brandProfileTag(brand.slug), { expire: 0 });
  await audit("brand.profile.save", brand.slug, "บันทึกโปรไฟล์แบรนด์", actor);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  const brand = await brandOf(props);
  if (!brand) return NextResponse.json({ ok: false, error: "ไม่พบแบรนด์นี้" }, { status: 404 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "use-auto") return NextResponse.json({ ok: false, error: "ไม่รู้จักคำสั่งนี้" }, { status: 400 });

  // Archived rather than deleted: the layout and its versions stay, and the
  // storefront ignores anything that is not "published" (see store.ts), so
  // the automatic page is back on the next request.
  await supabaseRest(`pages?kind=eq.brand&slug=eq.${pgValue(brand.slug)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "archived", publish_at: null, unpublish_at: null, next_boundary_at: null }),
  });
  revalidateTag(pageTag("brand", brand.slug), { expire: 0 });
  revalidateTag("pages", { expire: 0 });

  const actor = getAdminSession(token)?.userId ?? "shared-login";
  await audit("brand.page.use_auto", brand.slug, "กลับไปใช้หน้าแบรนด์อัตโนมัติ", actor);
  return NextResponse.json({ ok: true });
}

/** Best effort: the change already happened; its log line is secondary. */
async function audit(action: string, target: string, detail: string, actor: string) {
  try {
    await supabaseRest("admin_audit_log", {
      method: "POST",
      returning: false,
      body: JSON.stringify({ action, actor, target, detail }),
    });
  } catch (err) {
    console.error("[admin/brands] could not write the audit entry", err);
  }
}
