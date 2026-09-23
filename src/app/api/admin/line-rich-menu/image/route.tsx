import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { richMenuImage } from "@/lib/line-rich-menu-image";

// Preview of the generated artwork, so the grid can be checked against the
// button list before it is pushed to LINE — and after, since this is the same
// render that was installed.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  return richMenuImage();
}
