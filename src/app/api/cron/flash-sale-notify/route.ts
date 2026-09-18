import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase-server";
import { notifyQueue } from "@/lib/flash-sale-notify";

// Every minute during a sale: tell whoever's turn just came, and nudge whoever
// is about to lose their slot. A reservation window is measured in minutes, so
// a minute is the resolution that matters; outside a sale the queries match
// nothing and the run costs two index lookups.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });

  try {
    const result = await notifyQueue();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] flash-sale notify failed", err);
    return NextResponse.json({ ok: false, error: "notify failed" }, { status: 500 });
  }
}
