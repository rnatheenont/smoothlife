import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

// Records what someone searched for on the site.
//
// Public and unauthenticated, because the search box is — so it is written
// to be dull under abuse: one short row, a length cap, and a per-address
// ceiling well above what a person types but far below what a script would.
// Nothing about who searched is stored; see the table comment.
export const dynamic = "force-dynamic";

const MAX_LENGTH = 120;
const MIN_LENGTH = 2;
const PER_IP_PER_MINUTE = 20;

function normalize(query: string) {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: true });

  if (isRateLimited(`search-log:${clientIp(req)}`, PER_IP_PER_MINUTE, 60_000)) {
    // Not an error worth showing anyone: the search itself already worked.
    return NextResponse.json({ ok: true });
  }

  const body = await req.json().catch(() => null);
  const raw = typeof body?.query === "string" ? body.query.trim().slice(0, MAX_LENGTH) : "";
  const normalized = normalize(raw);
  if (normalized.length < MIN_LENGTH) return NextResponse.json({ ok: true });

  const results = Number.isFinite(body?.results) ? Math.max(0, Math.min(9999, Math.trunc(body.results))) : 0;

  try {
    await supabaseRest("search_queries", {
      method: "POST",
      returning: false,
      body: JSON.stringify({ query: raw, normalized, results }),
    });
  } catch (err) {
    // A missed row is a missed row. Never let analytics break a search.
    console.error("[search/log] could not record query", err);
  }
  return NextResponse.json({ ok: true });
}
