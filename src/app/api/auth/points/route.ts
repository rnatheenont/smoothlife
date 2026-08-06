import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ entries: [] });
  }
  const entries = await supabaseRest<
    { id: string; delta: number; reason: string; created_at: string; shopify_order_id: string | null }[]
  >(
    `points_ledger?user_id=eq.${uid}&select=id,delta,reason,created_at,shopify_order_id&order=created_at.desc&limit=50`
  );
  return NextResponse.json({ entries });
}
