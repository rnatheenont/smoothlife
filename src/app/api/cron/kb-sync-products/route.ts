import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase-server";
import { syncProductArticles } from "@/lib/kb-products";

// Daily: keep the assistant's product knowledge in step with the catalogue.
// It runs after the catalogue refresh (vercel.json), so a build that brought
// new product text is in the knowledge base the same morning. Runs are cheap
// when nothing changed — only articles whose text differs are rewritten.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  try {
    // Walk the catalogue in slices, with a budget well under the limit above.
    const started = Date.now();
    const totals = { created: 0, updated: 0, unchanged: 0, archived: 0, total: 0 };
    let offset: number | null = 0;
    while (offset !== null && Date.now() - started < 240_000) {
      const slice: Awaited<ReturnType<typeof syncProductArticles>> = await syncProductArticles(offset);
      totals.created += slice.created;
      totals.updated += slice.updated;
      totals.unchanged += slice.unchanged;
      totals.archived += slice.archived;
      totals.total = slice.total;
      offset = slice.nextOffset;
    }
    return NextResponse.json({ ok: true, ...totals, finished: offset === null, resumeFrom: offset });
  } catch (err) {
    console.error("[cron] kb product sync failed", err);
    return NextResponse.json({ ok: false, error: "sync failed" }, { status: 500 });
  }
}
