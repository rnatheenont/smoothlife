import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { brands, brandProducts, isHouseBrand } from "@/data/brands";
import { PAGES_BRAND_ENABLED } from "@/lib/feature-flags";

// Every brand, with how far its page has been dressed: whether it has a
// profile, and whether the team laid out a page of its own.
//
// The brand list itself comes from the catalogue (src/data/brands.ts), not
// from the database — a brand exists because the shop sells it, and a row
// here is only ever an addition to that.

type ProfileRow = { slug: string; hero_image: string; story: string; usp: unknown[]; featured_slugs: string[]; updated_at: string };
type PageRow = { slug: string; status: string };

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }

  let profiles: ProfileRow[] = [];
  let pages: PageRow[] = [];
  if (supabaseConfigured()) {
    try {
      [profiles, pages] = await Promise.all([
        supabaseRest<ProfileRow[]>("brand_profiles?select=slug,hero_image,story,usp,featured_slugs,updated_at&limit=500"),
        supabaseRest<PageRow[]>("pages?select=slug,status&kind=eq.brand&limit=500"),
      ]);
    } catch (err) {
      // The list is still useful without the extra columns; say so rather
      // than show an empty screen.
      console.error("[admin/brands] could not read profiles", err);
      return NextResponse.json({ ok: false, error: "อ่านข้อมูลโปรไฟล์แบรนด์ไม่สำเร็จ" }, { status: 500 });
    }
  }

  const profileBySlug = new Map(profiles.map((p) => [p.slug, p]));
  const pageBySlug = new Map(pages.map((p) => [p.slug, p]));

  const list = brands.map((b) => {
    const profile = profileBySlug.get(b.slug);
    const page = pageBySlug.get(b.slug);
    return {
      slug: b.slug,
      name: b.name,
      logo: b.image,
      isHouse: isHouseBrand(b.slug),
      productCount: brandProducts(b).filter((p) => p.inStock).length,
      profile: profile
        ? {
            hasHero: Boolean(profile.hero_image),
            hasStory: Boolean(profile.story?.trim()),
            uspCount: Array.isArray(profile.usp) ? profile.usp.length : 0,
            featuredCount: profile.featured_slugs?.length ?? 0,
            updatedAt: profile.updated_at,
          }
        : null,
      // "custom" only when that page is what customers see; a draft the team
      // started and left is still the automatic page as far as the site goes.
      layout: page?.status === "published" ? "custom" : page ? "custom-draft" : "auto",
    };
  });

  // House brands first, then by how much there is to sell — the order a
  // person deciding which page to dress first would want.
  list.sort((a, b) => Number(b.isHouse) - Number(a.isHouse) || b.productCount - a.productCount);

  return NextResponse.json({ ok: true, brands: list, liveOnSite: PAGES_BRAND_ENABLED });
}
