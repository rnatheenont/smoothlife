import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { appendMessage } from "@/lib/conversations";
import { deleteAttachmentsForConversation } from "@/lib/chat-attachments";

// The customer saying their question is answered.
//
// Nothing else can know this. Staff can see that a thread has gone quiet, but
// quiet means either "that solved it" or "they gave up" — opposite outcomes
// that look identical from the inbox. Asking the person who knows is the only
// honest signal, and it costs them one tap.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [conversation] = await supabaseRest<{ id: string; status: string }[]>(
    `conversations?channel=eq.web&channel_user_id=eq.${pgValue(uid)}&status=neq.resolved` +
      `&select=id,status&order=last_message_at.desc&limit=1`
  );
  if (!conversation) return NextResponse.json({ ok: true, alreadyClosed: true });

  // Recorded in the thread, not just flipped in a column: staff opening the
  // case later should see who closed it and why it stopped, rather than a
  // conversation that simply ends.
  await appendMessage({
    conversationId: conversation.id,
    senderType: "customer",
    content: "— ลูกค้ายืนยันว่าเรื่องนี้เรียบร้อยแล้ว —",
  });

  await supabaseRest(`conversations?id=eq.${pgValue(conversation.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "resolved", last_message_at: new Date().toISOString() }),
  });

  // Closing is the moment the consent text promised the photos would go, and
  // that promise should not depend on which side pressed the button.
  await deleteAttachmentsForConversation(conversation.id).catch((err) =>
    console.error("[chat/resolve-case] could not delete attachments", err)
  );

  return NextResponse.json({ ok: true });
}
