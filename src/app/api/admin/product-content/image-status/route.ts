import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import type { UploadedImage } from "@/lib/product-images";

// Which products have their own photographs, for the list page's column and
// its filter — "how many have we done, and which ones are left".
//
// Every row, not just the switched-on ones: a product someone uploaded for
// and then did not switch over is exactly the one worth finding again, and it
// is invisible in the storefront's own query (which asks for use_custom only).
//
// Not named .../images — that is the per-product route one segment down, and a
// sibling called "images" would quietly shadow a variant id spelled the same.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  variant_id: string;
  use_custom: boolean;
  images: UploadedImage[] | null;
  videos: UploadedImage[] | null;
};

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, items: [] });

  const rows = await supabaseRest<Row[]>(
    "product_image_overrides?select=variant_id,use_custom,images,videos",
  ).catch((): Row[] => []);

  return NextResponse.json({
    ok: true,
    items: rows.map((r) => ({
      variantId: r.variant_id,
      useCustom: r.use_custom,
      count: Array.isArray(r.images) ? r.images.filter((i) => i?.url).length : 0,
      videoCount: Array.isArray(r.videos) ? r.videos.filter((v) => v?.url).length : 0,
    })),
  });
}
