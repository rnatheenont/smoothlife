import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { uploadPublicImage, MAX_UPLOAD_BYTES } from "@/lib/public-uploads";

// A picture for a campaign step, straight off the machine the admin is at.
//
// The steps used to be three generic icons because there was nowhere to put
// anything else. A campaign's own artwork says more in the same space, and
// hunting for a CDN link first is a step nobody should have to take.

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
  const contentType =
    file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";

  try {
    const url = await uploadPublicImage({ folder: "campaign-steps", bytes: await file.arrayBuffer(), contentType });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[receipts/upload-image] upload failed", err);
    return NextResponse.json({ ok: false, error: "อัปโหลดรูปไม่สำเร็จ" }, { status: 502 });
  }
}
