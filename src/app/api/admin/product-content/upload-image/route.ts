import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { uploadPublicImage, MAX_UPLOAD_BYTES } from "@/lib/public-uploads";

// Lets an admin put a picture in a product-content block by choosing a file,
// rather than first uploading it somewhere else and pasting a link — the
// saved URL lands on the bucket host, which is one of the hosts the PUT route
// above accepts (IMAGE_HOSTS), so an upload is usable the moment it finishes.
//
// A static segment, so it never collides with the [variantId] route beside it
// (Next matches static before dynamic), and it sits under the same
// "/api/admin/product-content" prefix — a POST there already requires
// product_content.manage (admin-route-permissions.ts), so there is no new rule
// to add and no way to reach this with a read-only session.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json(
      { ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" },
      { status: 401 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "กรุณาแนบรูป" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: "ไฟล์ใหญ่เกินไป (ไม่เกิน 5MB)" },
      { status: 400 },
    );
  }
  const contentType =
    file.type === "image/png"
      ? "image/png"
      : file.type === "image/webp"
        ? "image/webp"
        : "image/jpeg";

  try {
    // Destructured: uploadPublicImage answers { url, path }, and sending the
    // whole object back as `url` put an object where the editor expected a
    // string — the block's preview then died on imageUrl.trim() and took the
    // whole editor down with it, every time anyone used this button.
    const { url } = await uploadPublicImage({
      folder: "product-content",
      bytes: await file.arrayBuffer(),
      contentType,
    });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[product-content/upload-image] upload failed", err);
    return NextResponse.json(
      { ok: false, error: "อัปโหลดรูปไม่สำเร็จ" },
      { status: 502 },
    );
  }
}
