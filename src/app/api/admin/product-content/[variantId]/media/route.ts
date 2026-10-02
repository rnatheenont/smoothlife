import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import {
  uploadPublicImage,
  publicStorageHost,
  createVideoUploadTicket,
  videoExtension,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_BYTES,
} from "@/lib/public-uploads";
import { getImageOverride, IMAGES_TAG, MAX_IMAGES, type UploadedImage } from "@/lib/product-images";
import { productContentTag, parseVideoUrl } from "@/lib/product-content";

// One product's own pictures and clips: upload them (POST), read them (GET),
// and say which set the shop should use (PUT).
//
// Lives under /api/admin/product-content so the existing
// product_content.view / .manage rules in admin-route-permissions.ts already
// cover it — an unlisted route is refused outright, so a new path here would
// otherwise 403 with nothing to explain why.
//
// Nothing in here can leave a product with no picture: PUT stores the switch
// and the lists, and the storefront's resolver falls back to Shopify whenever
// the picture list is empty. Turning the switch on with nothing uploaded is
// allowed and simply changes nothing on the site, which is what the warning in
// the editor says it will do.
//
// Pictures come through this route; videos do not, and cannot — see
// createVideoUploadTicket for why the browser has to send those straight to
// storage. What arrives here for a video is only its address.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ten clips is already more than any product page should ask anyone to sit
 *  through; the number exists so the list cannot grow without end. */
const MAX_VIDEOS = 10;

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
    videos: override?.videos ?? [],
    maxImages: MAX_IMAGES,
    maxVideos: MAX_VIDEOS,
    maxVideoBytes: MAX_VIDEO_BYTES,
  });
}

/**
 * One picture in, one stored picture out — or, with a JSON body asking for a
 * video, one upload ticket out and no bytes at all.
 *
 * The browser has already shrunk the picture (see the editor card); the size
 * check here is for everything else.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  const folder = `products/${variantId.split("/").pop() ?? "unknown"}`;

  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const contentType = typeof body?.contentType === "string" ? body.contentType : "";
    const size = Number(body?.size) || 0;
    if (!videoExtension(contentType)) {
      return NextResponse.json(
        { ok: false, error: "รองรับเฉพาะวิดีโอ MP4, WebM และ MOV" },
        { status: 400 },
      );
    }
    if (size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { ok: false, error: `ไฟล์ใหญ่เกินไป (ไม่เกิน ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB)` },
        { status: 400 },
      );
    }
    try {
      const ticket = await createVideoUploadTicket({ folder, contentType });
      return NextResponse.json({ ok: true, ...ticket });
    } catch (err) {
      console.error("[product-content/media] video ticket failed", err);
      return NextResponse.json({ ok: false, error: "เตรียมอัปโหลดวิดีโอไม่สำเร็จ" }, { status: 502 });
    }
  }

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
      folder,
      bytes: await file.arrayBuffer(),
      contentType: file.type,
    });
    return NextResponse.json({ ok: true, ...stored });
  } catch (err) {
    console.error("[product-content/media] upload failed", err);
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

  // A video is either a file in our own bucket or a link to a player we can
  // embed. parseVideoUrl is the one place that decides which — the same
  // function the page itself plays the clip with and the same allowlist the
  // CSP permits — so a link the shop could not play is refused here rather
  // than saved and silently skipped on the page.
  const videos: UploadedImage[] = [];
  for (const raw of Array.isArray(body.videos) ? body.videos.slice(0, MAX_VIDEOS) : []) {
    const url = typeof raw?.url === "string" ? raw.url.trim() : "";
    const path = typeof raw?.path === "string" ? raw.path.trim() : "";
    if (!url) continue;
    const parsed = parseVideoUrl(url);
    if (!parsed || (parsed.kind === "file" && host && !ours(url))) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "ลิงก์วิดีโอนี้เล่นไม่ได้ — รองรับ YouTube, Vimeo, Facebook, TikTok, Instagram " +
            "หรือไฟล์ที่อัปโหลดผ่านหน้านี้",
        },
        { status: 400 },
      );
    }
    if (videos.some((v) => v.url === url)) continue;
    videos.push(path ? { url, path } : { url });
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
      videos,
      updated_by: session?.userId ?? null,
      updated_at: new Date().toISOString(),
    }),
  });

  // The product page and every list that draws a card read the override map
  // under this tag; the product's own page also carries its content tag.
  revalidateTag(IMAGES_TAG, { expire: 0 });
  revalidateTag(productContentTag(variantId), { expire: 0 });

  return NextResponse.json({ ok: true, useCustom: body.useCustom === true, images, videos });
}
