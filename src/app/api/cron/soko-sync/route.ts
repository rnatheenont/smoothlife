import { NextRequest, NextResponse } from "next/server";
import { runSokoSync } from "@/lib/soko-sync-run";

// Pulls packed orders out of the warehouse system and puts their tracking
// numbers on the matching Shopify orders.
//
// A stopgap, and labelled as one: it screen-scrapes because sokochan's API
// isn't reachable yet. The moment they hand over an API — or point their
// existing webhook at us — this route should be deleted rather than kept
// "just in case", because a scraper that nobody needs is a scraper nobody
// notices breaking.
//
// The work itself lives in lib/soko-sync-run so the admin page's "run now"
// button runs exactly this, rather than a second copy of it.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron sends the secret as a bearer token; the same header lets a
  // person trigger a run by hand without a second mechanism to secure.
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { status, ...body } = await runSokoSync();
  return NextResponse.json(body, { status });
}
