import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { appendMessage, ConversationRow } from "@/lib/conversations";

// Hands the conversation back to the AI at the customer's request.
//
// Needed because the handover is otherwise one-way: once staff take a case,
// the AI stands down and the customer is stuck waiting even if what they
// wanted next was a question the bot could have answered in a second.
//
// It does not close the case or delete anything. The conversation stays in
// the inbox with a note saying the customer chose to carry on with Smoothie,
// so staff can still follow up on whatever they were handling — the customer
// is choosing who answers *next*, not cancelling their request.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const [conversation] = await supabaseRest<ConversationRow[]>(
    `conversations?channel=eq.web&channel_user_id=eq.${pgValue(uid)}` +
      `&status=in.(waiting_human,assigned)&select=*&order=last_message_at.desc&limit=1`
  ).catch(() => []);

  if (!conversation) {
    // Nothing was handed over, so nothing to hand back — and the AI is
    // already answering. Not an error worth showing anyone.
    return NextResponse.json({ ok: true, changed: false });
  }

  await supabaseRest(`conversations?id=eq.${pgValue(conversation.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "ai_handling" }),
  });

  await appendMessage({
    conversationId: conversation.id,
    senderType: "customer",
    content: "— ลูกค้าเลือกกลับไปคุยกับน้อง Smoothie ต่อ —",
  }).catch(() => {});

  return NextResponse.json({ ok: true, changed: true });
}
