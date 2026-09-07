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

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.action] = (acc[r.action] ?? 0) + 1;
    return acc;
  }, {});

  // Asked of Shopify rather than assumed: which app the website authenticates
  // as is exactly the thing that was guessed wrong once already, and writing
  // needs a scope the read-only work never did.
  const own = await getOwnAccessScopes();

  return NextResponse.json({
    ok: true,
    mode: process.env.TRACKING_SYNC_MODE || "dry-run",
    configured: Boolean(process.env.TRACKING_WEBHOOK_SECRET),
    app: own?.app ?? null,
    canWrite: Boolean(own?.scopes.includes("write_fulfillments")),
    counts,
    rows,
  });
}
