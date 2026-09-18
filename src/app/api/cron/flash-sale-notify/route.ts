import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase-server";
import { notifyQueue } from "@/lib/flash-sale-notify";

// Tell whoever's turn just came, and nudge whoever is about to lose their slot.
//
// Driven by pg_cron (public.fs_notify_tick, every 30 seconds), not by a Vercel
// cron: fs_sweep is what grants the slots, it already runs on that clock in the
// database, and the reminder should follow one tick behind the work rather than
// on a separate schedule. The database also checks whether anyone is waiting to
// be told before waking this route, so outside a sale it is never called.
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
