import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { FreeGiftPromoRow, rowToPromo, FREE_GIFT_COLUMNS } from "@/data/free-gifts";

// No dynamic API is used here (no cookies/headers/searchParams), so Next.js
// would otherwise treat this as a static route and cache its response
// forever within a server process — promos must always be live.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ promos: [] });
  try {
    const rows = await supabaseRest<FreeGiftPromoRow[]>(`free_gift_promos?active=eq.true&select=${FREE_GIFT_COLUMNS}`);
    return NextResponse.json({ promos: rows.map(rowToPromo) });
  } catch (err) {
    console.error("[free-gifts] fetch failed", err);
    return NextResponse.json({ promos: [] });
  }
}
