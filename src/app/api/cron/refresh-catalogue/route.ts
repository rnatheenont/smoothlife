import { NextRequest, NextResponse } from "next/server";

// products.generated.ts is only ever written by scripts/fetch-products.js
// during `next build` — Vercel's production filesystem is read-only at
// runtime, so there is no way to refresh stock/price numbers in place. The
// only real way to get fresher catalogue data live is to trigger a brand
// new build. Vercel Cron (see vercel.json) hits this route on a schedule;
// it just forwards to the project's Deploy Hook, which starts that rebuild.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return NextResponse.json(
      { ok: false, error: "VERCEL_DEPLOY_HOOK_URL not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(hookUrl, { method: "POST" });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Deploy hook returned ${res.status}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, triggeredAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Deploy hook request failed" },
      { status: 502 }
    );
  }
}
