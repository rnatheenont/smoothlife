import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { emailConfigured } from "@/lib/email";
import { linePushConfigured } from "@/lib/line-push";
import { getInboxAlertSettings, DEFAULT_WAITING_MINUTES } from "@/lib/inbox-alert";

// Where support-inbox alerts go, read and written by the team rather than by
// whoever has the Vercel account. The GET also reports whether the two
// delivery channels are configured at all, because "saved an address and
// still nothing arrives" is the confusing half of this — an address with no
// mail provider behind it looks identical to a working one.

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const settings = await getInboxAlertSettings();
  return NextResponse.json({
    ok: true,
    settings,
    defaultWaitingMinutes: DEFAULT_WAITING_MINUTES,
    channels: { email: emailConfigured(), line: linePushConfigured() },
  });
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const alertEmail = str(body.alertEmail, 200);
  const lineTo = str(body.lineTo, 100);

  // Enough of a check to catch a typo, not enough to argue about what an
  // address may contain. An address nobody can receive at is the failure this
  // screen exists to prevent.
  if (alertEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertEmail)) {
    return NextResponse.json({ ok: false, error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  // LINE ids are a letter and 32 hex characters: U… for one person, C… for a
  // group, R… for a chat room. Anything else is a paste of the wrong thing,
  // and a push to a wrong-but-valid id reaches a stranger.
  if (lineTo && !/^[UCR][0-9a-f]{32}$/.test(lineTo)) {
    return NextResponse.json(
      { ok: false, error: "LINE id ไม่ถูกต้อง — ต้องขึ้นต้นด้วย U (คน) C (กลุ่ม) หรือ R (ห้องแชท) ตามด้วยตัวอักษร 32 ตัว" },
      { status: 400 }
    );
  }

  const minutes = Number(body.waitingMinutes);
  if (body.waitingMinutes != null && (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440)) {
    return NextResponse.json({ ok: false, error: "เวลารอต้องอยู่ระหว่าง 1–1440 นาที" }, { status: 400 });
  }

  const session = getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  await supabaseRest("inbox_alert_settings?on_conflict=id", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      id: true,
      // Empty means "fall back to the environment", which is a real choice and
      // not the same as an empty string.
      alert_email: alertEmail || null,
      line_to: lineTo || null,
      waiting_minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
      updated_at: new Date().toISOString(),
      updated_by: session?.userId ?? null,
    }),
  });

  return NextResponse.json({ ok: true, settings: await getInboxAlertSettings() });
}
