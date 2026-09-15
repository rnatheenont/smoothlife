import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { probeOrderList, probeOrderStatuses, SokoError } from "@/lib/soko";

// "อ่าน 0 หน้า" with a working login gives no clue on its own. This asks soko
// the list query with and without its conditions and reports the timings, so
// a blind sync can be told apart from a slow one without another deploy.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const pick = Array.isArray(body?.variants) && body.variants.length ? body.variants.map(String).slice(0, 6) : undefined;
  const timeoutMs = Number(body?.timeoutMs) > 0 ? Math.min(Number(body.timeoutMs), 90_000) : undefined;
  const orderHref = typeof body?.orderHref === "string" ? body.orderHref : "";
  try {
    if (orderHref) return NextResponse.json({ ok: true, ...(await probeOrderStatuses(orderHref)) });
    // Raw grid queries for measuring: only soko's own Merchantorders* keys.
    const custom = (Array.isArray(body?.custom) ? body.custom : [])
      .slice(0, 4)
      .map((c: unknown) =>
        Object.fromEntries(
          Object.entries(c && typeof c === "object" ? c : {})
            .filter(([k]) => /^Merchantorders[\w\[\]]*$/.test(k))
            .map(([k, v]) => [k, String(v).slice(0, 60)])
        )
      );
    const names = pick ?? (custom.length ? custom.map((_: unknown, i: number) => `custom${i}`) : undefined);
    return NextResponse.json({ ok: true, ...(await probeOrderList(names, timeoutMs, custom)) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof SokoError ? err.message : String(err) },
      { status: 502 }
    );
  }
}
