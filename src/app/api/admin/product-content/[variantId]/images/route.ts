import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { uploadPublicImage, publicStorageHost, MAX_UPLOAD_BYTES } from "@/lib/public-uploads";
import { getImageOverride, IMAGES_TAG, MAX_IMAGES, type UploadedImage } from "@/lib/product-images";
import { productContentTag } from "@/lib/product-content";

// One product's own photographs: upload them (POST), read them (GET), and say
// which set the shop should use (PUT).
//
// Lives under /api/admin/product-content so the existing
// product_content.view / .manage rules in admin-route-permissions.ts already
// cover it — an unlisted route is refused outright, so a new path here would
// otherwise 403 with nothing to explain why.
//
// Nothing in here can leave a product with no picture: PUT stores the switch
// and the list, and the storefront's resolver falls back to Shopify whenever
// the list is empty. Turning the switch on with nothing uploaded is allowed
// and simply changes nothing on the site, which is what the warning in the
// editor says it will do.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest, props: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const override = await getImageOverride(variantId);
  return NextResponse.json({
    ok: true,
    useCustom: override?.useCustom ?? false,
    images: override?.images ?? [],
    maxImages: MAX_IMAGES,
  });
}

/** One file in, one stored image out. The browser has already shrunk it (see
 *  the editor card); this is the size guard for everything else. */
export async function POST(req: NextRequest, props: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "กรุณาแนบรูป" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกินไป (ไม่เกิน 5MB)" }, { status: 400 });
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return NextResponse.json(
      { ok: false, error: "รองรับเฉพาะไฟล์ JPG, PNG และ WebP" },
      { status: 400 }
    );
  }

  try {
    const stored = await uploadPublicImage({
      // Foldered by product so storage can be read by a human later, and so a
      // future cleanup can find everything one product ever used.
      folder: `products/${variantId.split("/").pop() ?? "unknown"}`,
      bytes: await file.arrayBuffer(),
      contentType: file.type,
    });
    return NextResponse.json({ ok: true, ...stored });
  } catch (err) {
    console.error("[product-content/images] upload failed", err);
    return NextResponse.json({ ok: false, error: "อัปโหลดรูปไม่สำเร็จ" }, { status: 502 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.images)) {
    return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  // Only our own storage. Accepting any URL would turn this into an open
  // redirect for product photography — somebody else's server deciding what a
  // Smoothlife product looks like, and able to change it afterwards.
  //
  // Compared host to host, not as a string prefix: publicStorageHost() returns
  // a bare hostname, and a prefix test would also wave through
  // https://<our-host>.evil.example.com/.
  const host = publicStorageHost();
  const ours = (url: string) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && u.hostname === host;
    } catch {
      return false;
    }
  };
  const images: UploadedImage[] = [];
  for (const raw of body.images.slice(0, MAX_IMAGES)) {
    const url = typeof raw?.url === "string" ? raw.url.trim() : "";
    const path = typeof raw?.path === "string" ? raw.path.trim() : "";
    if (!url) continue;
    if (host && !ours(url)) {
      return NextResponse.json(
        { ok: false, error: "รูปต้องเป็นไฟล์ที่อัปโหลดผ่านหน้านี้เท่านั้น" },
        { status: 400 }
      );
    }
    if (images.some((i) => i.url === url)) continue; // a duplicate would collide as a React key
    images.push({ url, path });
  }

  const session = getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  await supabaseRest("product_image_overrides?on_conflict=variant_id", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      variant_id: variantId,
      slug: typeof body.slug === "string" ? body.slug.slice(0, 200) : null,
      use_custom: body.useCustom === true,
      images,
      updated_by: session?.userId ?? null,
      updated_at: new Date().toISOString(),
    }),
  });

  // The product page and every list that draws a card read the override map
  // under this tag; the product's own page also carries its content tag.
  revalidateTag(IMAGES_TAG, { expire: 0 });
  revalidateTag(productContentTag(variantId), { expire: 0 });

  return NextResponse.json({ ok: true, useCustom: body.useCustom === true, images });
}
