import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// How far behind the inbox is, for the badge in the sidebar.
//
// Every admin page polls this, so it does not go near the list endpoint — that
// one reads a hundred conversations and four hundred messages to draw a
// screen. inbox_unread_counts() answers in the database and returns three
// numbers.
//
// "Unread" is the customer's words since staff last opened the thread. A reply
// somebody typed themselves is not unread, which is why a thread can show a
// brand new message and no badge — the newest thing in it is ours.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const [counts] = await supabaseRest<{ messages: number; conversations: number; urgent: number }[]>(
    "rpc/inbox_unread_counts",
    { method: "POST", body: "{}" }
  ).catch((): { messages: number; conversations: number; urgent: number }[] => []);

  return NextResponse.json({
    ok: true,
    messages: counts?.messages ?? 0,
    conversations: counts?.conversations ?? 0,
    urgent: counts?.urgent ?? 0,
  });
}
