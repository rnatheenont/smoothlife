import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import {
  richMenuConfigured,
  listRichMenus,
  getDefaultRichMenuId,
  installRichMenu,
  deleteRichMenu,
  RICH_MENU_BUTTONS,
} from "@/lib/line-rich-menu";

export const runtime = "nodejs";

const REQUIRED_WIDTH = 2500;
const REQUIRED_HEIGHT = 1686;
const MAX_BYTES = 1024 * 1024; // LINE's limit

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

/**
 * PNG dimensions live in the IHDR chunk at a fixed offset, so they can be read
 * without an image library. Worth doing: a wrong-sized image is the mistake
 * everyone makes here, and catching it locally gives a sentence a person can
 * act on instead of LINE's generic rejection.
 */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const isPng =
    bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!isPng) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();

  const buttons = RICH_MENU_BUTTONS.map((b) => ({ label: b.label, path: b.path }));
  if (!richMenuConfigured()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      buttons,
      // Said plainly rather than as a generic "not configured": this needs an
      // account that does not exist yet, which is a different problem from a
      // missing environment variable.
      reason:
        "ยังไม่ได้ตั้งค่า LINE_MESSAGING_ACCESS_TOKEN — ต้องมี LINE Official Account และเปิด Messaging API ก่อน (ตอนนี้มีแต่ LINE Login channel)",
    });
  }

  try {
    const [menus, defaultId] = await Promise.all([listRichMenus(), getDefaultRichMenuId()]);
    return NextResponse.json({ ok: true, configured: true, buttons, menus, defaultRichMenuId: defaultId });
  } catch (err) {
    return NextResponse.json(
      { ok: false, configured: true, buttons, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!richMenuConfigured()) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า LINE Messaging API" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "กรุณาแนบไฟล์รูปเมนู" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `ไฟล์ใหญ่เกิน 1 MB (ไฟล์นี้ ${(file.size / 1024 / 1024).toFixed(2)} MB)` },
      { status: 400 }
    );
  }

  const contentType = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  const bytes = await file.arrayBuffer();

  const size = pngSize(new Uint8Array(bytes));
  if (size && (size.width !== REQUIRED_WIDTH || size.height !== REQUIRED_HEIGHT)) {
    return NextResponse.json(
      {
        ok: false,
        error: `ขนาดรูปต้องเป็น ${REQUIRED_WIDTH}×${REQUIRED_HEIGHT} px พอดี (ไฟล์นี้ ${size.width}×${size.height})`,
      },
      { status: 400 }
    );
  }

  try {
    // Replace rather than accumulate: LINE keeps every menu ever created, and
    // a list of near-identical old ones makes it impossible to tell later
    // which one customers are actually seeing.
    const existing = await listRichMenus();
    const { richMenuId } = await installRichMenu({ bytes, contentType });
    for (const m of existing) {
      if (m.richMenuId !== richMenuId) await deleteRichMenu(m.richMenuId).catch(() => {});
    }
    return NextResponse.json({ ok: true, richMenuId });
  } catch (err) {
    console.error("[admin/line-rich-menu] install failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "ติดตั้งเมนูไม่สำเร็จ" },
      { status: 502 }
    );
  }
}
