import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { richMenuConfigured, setWebhookEndpoint } from "@/lib/line-rich-menu";
import { SITE_URL } from "@/lib/site-url";

export const runtime = "nodejs";

/**
 * Points LINE's webhook back at this site.
 *
 * This exists as a button rather than as console instructions because the
 * value it writes is `SITE_URL` — the server already knows the right answer,
 * and the step everybody got wrong was pasting the preview domain
 * (smoothlife.vercel.app) into a field that decides where live customer
 * messages are delivered. The admin presses once; nobody retypes a URL.
 *
 * The access token is read from the server's own environment, so the URL can
 * be changed without the token ever leaving it.
 */
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!richMenuConfigured()) {
    return NextResponse.json(
      { ok: false, error: "ยังไม่ได้ตั้งค่า LINE_MESSAGING_ACCESS_TOKEN" },
      { status: 503 },
    );
  }

  const endpoint = `${SITE_URL}/api/webhooks/line`;

  // Previews share the production token, so this same button on a preview
  // deployment would hand every live customer message to a throwaway URL —
  // which is the exact bug it is here to fix. Refuse instead.
  if (new URL(endpoint).hostname.endsWith(".vercel.app")) {
    return NextResponse.json(
      {
        ok: false,
        error: `หน้านี้กำลังรันบน ${new URL(endpoint).hostname} ซึ่งเป็นโดเมนชั่วคราว — เปิดจาก app.smoothlife.com แล้วกดอีกครั้ง`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await setWebhookEndpoint(endpoint);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/line-rich-menu/webhook] set failed", err);
    return NextResponse.json(
      {
        ok: false,
        // LINE rejects an endpoint that is not reachable over HTTPS or that
        // answers its verification probe with an error, and the reason is in
        // the body it sends back — worth passing through rather than flattening
        // to "ตั้งค่าไม่สำเร็จ".
        error: "ตั้งค่า Webhook URL ไม่สำเร็จ",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
