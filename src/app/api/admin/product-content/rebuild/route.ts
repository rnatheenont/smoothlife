import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";

// "Update the whole site now" — a rebuild, asked for by a person.
//
// The pages the server renders already change the moment an admin saves; this
// is for the rest of the shop. The cart, the search page, the chat's product
// chips and about twenty more client components import the generated
// catalogue straight into the browser bundle, and that file is only written
// by scripts/fetch-products.js during a build (Vercel's filesystem is
// read-only at runtime). So the only way to change what they show is to build
// again — which is what the nightly 03:00 cron does, and what this does
// early.
//
// It costs a deployment, and the plan allows 100 a day; spend them all and
// nothing can be deployed for 24 hours, including a fix for something broken.
// Hence the cooldown, and hence the row written before the hook is called.
//
// Sits under /api/admin/product-content so the existing
// product_content.manage rule covers it (admin-route-permissions.ts).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOLDOWN_MINUTES = 30;

type Row = { triggered_at: string };

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  const last = await lastRebuild();
  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.VERCEL_DEPLOY_HOOK_URL),
    lastTriggeredAt: last,
    cooldownMinutes: COOLDOWN_MINUTES,
    readyAt: last ? new Date(Date.parse(last) + COOLDOWN_MINUTES * 60_000).toISOString() : null,
  });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }

  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return NextResponse.json(
      { ok: false, error: "ยังไม่ได้ตั้งค่า deploy hook — อัปเดตจะเกิดตามรอบ build ตอน 03:00" },
      { status: 503 },
    );
  }

  const last = await lastRebuild();
  if (last) {
    const waited = (Date.now() - Date.parse(last)) / 60_000;
    if (waited < COOLDOWN_MINUTES) {
      const left = Math.ceil(COOLDOWN_MINUTES - waited);
      return NextResponse.json(
        {
          ok: false,
          error: `เพิ่งสั่งอัปเดตไปเมื่อสักครู่ — รออีก ${left} นาทีค่อยสั่งใหม่ได้`,
          readyAt: new Date(Date.parse(last) + COOLDOWN_MINUTES * 60_000).toISOString(),
        },
        { status: 429 },
      );
    }
  }

  // Which screen asked, from a fixed list rather than free text — the row is
  // written by whatever the browser sent, and "where did this deployment come
  // from" is not a question worth letting a client answer in its own words.
  const body = await req.json().catch(() => null);
  const asked = (body as { reason?: unknown } | null)?.reason;
  const reason = asked === "overview" ? "overview" : "product-images";

  // Written before the hook fires, not after: a hook that succeeds while the
  // response is lost would otherwise leave no record and no cooldown, and the
  // next click would spend another deployment for nothing.
  const session = getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  if (supabaseConfigured()) {
    await supabaseRest("catalogue_rebuilds", {
      method: "POST",
      returning: false,
      body: JSON.stringify({ triggered_by: session?.userId ?? null, reason }),
    }).catch(() => {});
  }

  try {
    const res = await fetch(hookUrl, { method: "POST" });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `เรียก deploy hook ไม่สำเร็จ (${res.status})` },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json({ ok: false, error: "เรียก deploy hook ไม่สำเร็จ" }, { status: 502 });
  }

  // `readyAt` on the success too, not only on the refusal: without it the
  // button went straight back to enabled after a rebuild it had just started,
  // and the next click's only answer was a 429.
  const triggeredAt = new Date();
  return NextResponse.json({
    ok: true,
    triggeredAt: triggeredAt.toISOString(),
    readyAt: new Date(triggeredAt.getTime() + COOLDOWN_MINUTES * 60_000).toISOString(),
  });
}

async function lastRebuild(): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const rows = await supabaseRest<Row[]>(
    "catalogue_rebuilds?select=triggered_at&order=triggered_at.desc&limit=1",
  ).catch((): Row[] => []);
  return rows[0]?.triggered_at ?? null;
}
