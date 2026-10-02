import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { transcriptKeyFor, ConversationRow } from "@/lib/conversations";
import { translateForCustomer } from "@/lib/reply-translate";

// What POST .../route.ts would translate a reply into, computed early so
// staff can see and edit it before anything is sent — the real send still
// translates for itself when this step is skipped, so this route only ever
// shows staff a preview, it is never the only place translation happens.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ ok: false, error: "ไม่มีข้อความให้ตรวจ" }, { status: 400 });

  const [conversation] = await supabaseRest<ConversationRow[]>(
    `conversations?id=eq.${pgValue(params.id)}&select=*&limit=1`
  );
  if (!conversation) return NextResponse.json({ ok: false, error: "ไม่พบบทสนทนานี้" }, { status: 404 });

  const transcriptKey = transcriptKeyFor(conversation);
  // Same source and shape as the real send path (role='user' only, newest
  // first then reversed) — a different reading here would preview one
  // language and actually translate into another.
  const prior = await supabaseRest<{ content: string }[]>(
    `chat_messages?session_key=eq.${pgValue(transcriptKey)}&role=eq.user` +
      `&select=content&order=created_at.desc&limit=6`
  ).catch((): { content: string }[] => []);

  const translated = await translateForCustomer({
    staffReply: content,
    customerMessages: prior
      .map((m) => m.content.replace(/^\[\[PHOTO\]\]\s*/, "").trim())
      .filter((c) => c && c !== "(ส่งรูป)")
      .reverse(),
  });

  // null means "send as typed" — already the customer's language, or nothing
  // to go on yet.
  return NextResponse.json({ ok: true, translated });
}
