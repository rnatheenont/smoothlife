import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase-server";
import { backfillEmbeddings } from "@/lib/kb";

// Daily knowledge-base maintenance: give an embedding to anything still
// without one — every article written before an embedding provider was
// configured, and anything saved while the provider was rate-limited.
//
// It used to also copy the whole catalogue into the knowledge base as one
// article per product. That is gone: the assistant reads a product's own page
// content through get_product_details instead, which is the same text the
// customer is looking at and does not need a second copy that drifts.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  try {
    const backfill = await backfillEmbeddings(240_000);
    return NextResponse.json({ ok: true, ...backfill });
  } catch (err) {
    console.error("[cron] kb embedding backfill failed", err);
    return NextResponse.json({ ok: false, error: "backfill failed" }, { status: 500 });
  }
}
