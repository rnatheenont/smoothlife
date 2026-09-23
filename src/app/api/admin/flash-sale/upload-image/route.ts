import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { uploadPublicImage, MAX_UPLOAD_BYTES } from "@/lib/public-uploads";

// Lets an admin attach a campaign banner directly instead of hunting for a
// CDN link first — see the allowlist in flash-sale-campaigns.ts, which only
// otherwise accepts cdn.shopify.com / smoothlife.com links. Gated by the
// same "/api/admin/flash-sale" -> flash_sale.manage rule every other
// mutating flash-sale route uses (admin-route-permissions.ts); no new entry
// needed there.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "กรุณาแนบรูป" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกินไป (ไม่เกิน 5MB)" }, { status: 400 });
  }
  const contentType = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";

  try {
    const url = await uploadPublicImage({
      folder: "flash-sale-hero",
      bytes: await file.arrayBuffer(),
      contentType,
    });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[flash-sale/upload-image] upload failed", err);
    return NextResponse.json({ ok: false, error: "อัปโหลดรูปไม่สำเร็จ" }, { status: 502 });
  }
}
