import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { heroBanners } from "@/data/heroBanners";
import { getLiveHeroBanners } from "@/lib/shopify-admin";
import { getStorefrontHeroBanners } from "@/lib/storefront-banners";

// The banners the hero_banners section is pulling right now, so the editor
// can offer them as a starting point instead of asking someone to find the
// same artwork again by hand.
//
// Same three sources in the same order as the section's own loader
// (storefront, then the Shopify theme, then the list in the repo) — the
// point of this route is to hand back exactly what the page is showing, so
// the order has to match, and `source` says which one answered. Read-only.

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }

  const storefront = await getStorefrontHeroBanners();
  const live = storefront ?? (await getLiveHeroBanners());
  const source = storefront ? "storefront" : live ? "shopify" : "repo";
  const banners = live ?? heroBanners;

  return NextResponse.json({
    ok: true,
    source,
    // The shape the editor's banner rows use: four strings, never undefined,
    // so an imported row and a hand-made one are the same thing afterwards.
    // The Shopify-theme shape has no title at all (it is a slideshow block,
    // not an article), so a description is something the team writes here
    // after importing rather than something that comes with the picture.
    banners: banners.map((b) => ({
      image: b.image,
      mobileImage: b.mobileImage ?? "",
      href: b.href,
      title: "title" in b && typeof b.title === "string" ? b.title : "",
    })),
  });
}
