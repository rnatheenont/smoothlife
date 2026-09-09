import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { getOwnAccessScopes } from "@/lib/shopify-admin";

// What the tracking sync has been told and what it decided. During dry-run
// this is the whole product: the mismatches are the thing worth looking at,
// because each one is either a mis-keyed number already live on an order or a
// mapping bug that must be fixed before anything is allowed to write.

export type TrackingSyncRow = {
  id: string;
  received_at: string;
  source: string;
  mode: string;
  order_ref: string;
  tracking_number: string;
  resolved_order_name: string | null;
  action: string;
  reason: string | null;
  existing_numbers: string[] | null;
  applied: boolean;
  resolved_at: string | null;
  resolution: string | null;
  error: string | null;
  /** Numbers invented while wiring the integration up, not real parcels. */
  is_test: boolean;
};

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  const rows = await supabaseRest<TrackingSyncRow[]>(
    "tracking_sync_log?select=*&order=received_at.desc&limit=200"
  ).catch((): TrackingSyncRow[] => []);

  // Test rows are excluded from the counts. Leaving them in meant the tiles
  // above the table described a warehouse that had shipped parcels nobody
  // ever packed.
  const real = rows.filter((r) => !r.is_test);
  const counts = real
    .filter((r) => r.action !== "run-empty" && r.action !== "run-failed")
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.action] = (acc[r.action] ?? 0) + 1;
      return acc;
    }, {});

  // Whether the scraper can still get in, kept apart from what it is allowed
  // to write. They are different questions and the page used to answer them in
  // one sentence, so a login that had been failing for an hour read as a note
  // about write mode.
  const failures = real.filter((r) => r.action === "run-failed");
  const lastSuccess = real.find((r) => r.action !== "run-failed")?.received_at ?? null;
  const lastFailure = failures[0] ?? null;
  // Consecutive, from the newest backwards: one bad run in a good stretch is
  // noise, four in a row is the integration being down.
  let consecutiveFailures = 0;
  for (const r of real) {
    if (r.action !== "run-failed") break;
    consecutiveFailures++;
  }

  // Asked of Shopify rather than assumed: which app the website authenticates
  // as is exactly the thing that was guessed wrong once already, and writing
  // needs a scope the read-only work never did.
  const own = await getOwnAccessScopes();

  return NextResponse.json({
    ok: true,
    mode: process.env.TRACKING_SYNC_MODE || "dry-run",
    configured: Boolean(process.env.TRACKING_WEBHOOK_SECRET),
    app: own?.app ?? null,
    // For the "search in Shopify" link on rows whose order could not be found.
    shopDomain: process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN?.replace(".myshopify.com", "") ?? null,
    canWrite: Boolean(own?.scopes.includes("write_fulfillments")),
    // Option B (fulfil automatically) additionally needs to read and write
    // fulfillment orders — a different scope from write_fulfillments, and the
    // one whose absence made every order look like it didn't exist.
    canFulfil: Boolean(
      own?.scopes.includes("write_merchant_managed_fulfillment_orders") &&
        own?.scopes.includes("read_merchant_managed_fulfillment_orders")
    ),
    counts,
    connection: {
      lastSuccessAt: lastSuccess,
      lastFailureAt: lastFailure?.received_at ?? null,
      lastFailureReason: lastFailure?.error ?? lastFailure?.reason ?? null,
      consecutiveFailures,
    },
    testRowCount: rows.length - real.length,
    rows,
  });
}
