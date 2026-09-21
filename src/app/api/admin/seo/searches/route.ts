import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

// What the shop's own visitors searched for. The closest thing to keyword
// volume that does not require buying a subscription — and unlike a volume
// estimate, these are people who were already on the site meaning to buy.
export const dynamic = "force-dynamic";

export type SearchStat = {
  normalized: string;
  searches: number;
  zero_result_searches: number;
  last_searched: string;
};

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, searches: [] });
  const days = Number(req.nextUrl.searchParams.get("days")) || 90;

  const rows = await supabaseRest<SearchStat[]>("rpc/search_query_stats", {
    method: "POST",
    body: JSON.stringify({ p_days: days, p_limit: 100 }),
  }).catch((): SearchStat[] => []);

  return NextResponse.json({ ok: true, days, searches: rows });
}
