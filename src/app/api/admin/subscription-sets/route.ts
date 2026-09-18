import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { SET_COLUMNS, parseSetInput, setSummary, writeItems, type SubscriptionSet } from "@/lib/subscription-sets";

// Admin: the curated subscription sets — list and create.
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const sets = await supabaseRest<SubscriptionSet[]>(`subscription_sets?select=${SET_COLUMNS}&order=created_at.desc&limit=200`);
  // The catalogue knows what is in stock and what each item costs, so the
  // summary — savings, and whether the set can be sold today — is worked out
  // here rather than stored and left to go stale.
  return NextResponse.json({
    ok: true,
    sets: sets.map((set) => ({ ...set, summary: setSummary(set) })),
  });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const parsed = parseSetInput(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  const [set] = await supabaseRest<SubscriptionSet[]>(`subscription_sets?select=${SET_COLUMNS}`, {
    method: "POST",
    body: JSON.stringify(parsed.row),
  });
  await writeItems(set.id, parsed.items);

  const [saved] = await supabaseRest<SubscriptionSet[]>(`subscription_sets?id=eq.${set.id}&select=${SET_COLUMNS}`);
  return NextResponse.json({ ok: true, set: { ...saved, summary: setSummary(saved) } });
}
