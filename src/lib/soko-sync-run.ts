import { fetchPackedOrders, sokoConfigured, SokoError, lastDiagnostics } from "@/lib/soko";
import { processTrackingUpdate, logSyncFailure, logSyncHeartbeat, trackingMode } from "@/lib/tracking-apply";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { shopifyAdminConfigured } from "@/lib/shopify-admin";

// One run of the warehouse sync, so the cron and the admin page's "run now"
// button are the same code rather than two things that drift. The cron owns
// the schedule and the admin route owns the auth; neither owns the work.

export type SyncRunResult = {
  ok: boolean;
  status: number;
  error?: string;
  mode?: string;
  found?: number;
  skipped?: number;
  /** Rows the clock ran out on. They stay unwritten and come back next run. */
  unfinished?: number;
  applied?: number;
  conflicts?: number;
  diagnostics?: unknown;
  results?: unknown[];
};

// The function's own limit is 300s; stopping short of it means a run always
// comes back with a result and a log row instead of being killed mid-write.
const RUN_BUDGET_MS = 300_000;

export async function runSokoSync(
  /** What started this run, recorded on every row it writes. */
  triggeredBy: "cron" | "admin" = "cron",
): Promise<SyncRunResult> {
  // Everything below shares the function's five minutes. The scraper gets most
  // of it and hands back whatever it has; the Shopify writes follow, and a
  // partial run that reports itself beats a timeout that reports nothing.
  const started = Date.now();
  if (!supabaseConfigured() || !shopifyAdminConfigured()) {
    return { ok: false, status: 503, error: "not configured" };
  }
  if (!sokoConfigured()) {
    return { ok: false, status: 503, error: "ยังไม่ได้ตั้งค่า SOKO_USERNAME / SOKO_PASSWORD" };
  }

  // Orders already confirmed on the Shopify side. Walking five list pages
  // turns up fifty rows, and opening every one of their View pages would not
  // fit the minute this function gets — so the reads are spent on orders
  // nothing is known about yet. Only an exact list-number match is skipped:
  // soko splits a part-shipped order into "#4161_F", which is a different
  // parcel with a different number and must still be read.
  let skipRefs = new Set<string>();
  try {
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const done = await supabaseRest<{ order_ref: string | null; action: string; reason: string | null }[]>(
      `tracking_sync_log?select=order_ref,action,reason&received_at=gte.${since}&or=(action.eq.already-set,applied.is.true,action.eq.not-eligible)`,
    );
    // Not-eligible only when it can never change: a follow-up box (_F) that
    // the settings say not to write, or a cancelled order. An unpaid order is
    // not skipped — it may be paid by the next run. Re-reading the permanent
    // ones every run used up the order-page allowance before newer orders.
    const permanent = (d: { action: string; reason: string | null }) =>
      d.action !== "not-eligible" || /_F|ยกเลิก/.test(d.reason ?? "");
    skipRefs = new Set(
      done
        .filter(permanent)
        .map((d) => d.order_ref)
        .filter((r): r is string => Boolean(r)),
    );
  } catch (err) {
    // Worst case we re-read a few View pages we did not have to.
    console.error("[soko-sync] could not load already-synced refs", err);
  }

  let rows: Awaited<ReturnType<typeof fetchPackedOrders>>;
  try {
    // 44s of the minute, up from 38: the store-filtered list page alone takes
    // 20s at soko's current speed, and a budget that cannot fit one page plus
    // a couple of order reads comes back empty every time.
    // 200s of the five minutes (see api/cron/soko-sync): room for a slow list
    // page or two and the order pages after them, leaving the rest for the
    // Shopify writes.
    rows = await fetchPackedOrders(40, skipRefs, Math.max(5_000, RUN_BUDGET_MS - 100_000 - (Date.now() - started)));
  } catch (err) {
    // A scraper's worst failure is the silent one: the login page changes, the
    // run returns nothing, and everyone assumes there was nothing to send.
    // Recorded so /admin/tracking-sync shows it.
    const message = err instanceof SokoError ? err.message : `ดึงข้อมูลจาก soko ไม่สำเร็จ: ${err}`;
    await logSyncFailure("soko-puller", message);
    return { ok: false, status: 502, error: message };
  }

  if (rows.length === 0) {
    // Recorded, not silent. A quiet warehouse and a scraper that has gone
    // blind used to leave identical evidence — nothing — and telling those
    // apart took a day each of the two times it mattered.
    await logSyncHeartbeat("soko-puller", {
      pagesScanned: lastDiagnostics?.pagesScanned,
      candidates: lastDiagnostics?.candidates,
      skipped: lastDiagnostics?.skipped,
      ranOutOfTime: lastDiagnostics?.ranOutOfTime,
      // Only the pages soko answered: a page that timed out took the ceiling,
      // not soko's own time, and averaging the ceiling in would flatter or
      // ruin the figure depending on which way it broke.
      pageMs: lastDiagnostics?.pageAttempts?.filter((a) => a.outcome === "ok").map((a) => a.ms),
    });
    return {
      ok: true,
      status: 200,
      mode: trackingMode(),
      found: 0,
      skipped: skipRefs.size,
      diagnostics: lastDiagnostics,
      results: [],
    };
  }

  // This loop, not the scraper, is what kept overrunning the minute. soko
  // answers in under half a second — measured — while each order here means
  // several Shopify calls, and a dozen of those is easily past 60s. Stop at 50
  // and leave the rest: an order that was not written is not in the skip list,
  // so the next run picks it up exactly where this one stopped.
  const results = [];
  let unfinished = 0;
  for (const row of rows) {
    if (Date.now() - started > RUN_BUDGET_MS - 20_000) {
      unfinished = rows.length - results.length;
      break;
    }
    // Sequential on purpose: the hourly cap is counted from rows already
    // written, and firing these in parallel would let a batch race past it.
    const r = await processTrackingUpdate({ ...row, source: "soko-puller", triggeredBy });
    results.push({ orderRef: row.parcelRef, ...r });
  }

  return {
    ok: true,
    status: 200,
    mode: trackingMode(),
    found: results.length,
    unfinished,
    skipped: skipRefs.size,
    diagnostics: lastDiagnostics,
    applied: results.filter((r) => r.applied).length,
    conflicts: results.filter((r) => r.action === "conflict").length,
    results,
  };
}
