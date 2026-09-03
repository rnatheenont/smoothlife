import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { openConversation, appendMessage } from "@/lib/conversations";

// Flags a chat conversation for a human to follow up on, and puts it in front
// of one: as well as the chat_escalations row it has always written, this now
// opens a conversation in the unified inbox with the transcript attached, so
// the request lands somewhere staff actually look instead of a table nobody
// reads. Requires login so there's a real way to contact the customer back;
// never touches Shopify.
export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "กรุณาเข้าสู่ระบบก่อน เพื่อให้ทีมงานติดต่อกลับได้ค่ะ" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json({ ok: false, error: "ไม่มีข้อความสนทนาให้ส่งค่ะ" }, { status: 400 });
  }

  const [user] = await supabaseRest<{ phone: string | null }[]>(`users?id=eq.${uid}&select=phone`);
  const [emailIdentity] = await supabaseRest<{ provider_uid: string }[]>(
    `auth_identities?user_id=eq.${uid}&provider=eq.email&select=provider_uid&limit=1`
  );

  const contactMethod = user?.phone ? "phone" : emailIdentity ? "email" : null;
  const contactValue = user?.phone || emailIdentity?.provider_uid || null;

  const [created] = await supabaseRest<{ id: string }[]>("chat_escalations", {
    method: "POST",
    body: JSON.stringify({
      user_id: uid,
      session_key: uid,
      contact_method: contactMethod,
      contact_value: contactValue,
      transcript: transcript.slice(0, 8000),
    }),
  });

  // The inbox is the part staff work from; the escalation row above stays as
  // the durable record. A failure here must not lose the customer's request,
  // which is already safely written, so it only degrades the experience.
  try {
    const conversation = await openConversation({
      channel: "web",
      channelUserId: uid,
      userId: uid,
      status: "waiting_human",
      subject: "ขอคุยกับทีมงาน (จากแชทน้อง Smoothie)",
    });
    if (conversation) {
      await appendMessage({
        conversationId: conversation.id,
        senderType: "customer",
        content: transcript,
      });
    }
  } catch (err) {
    console.error("[chat/escalate] escalation saved but inbox handoff failed", err);
  }

  return NextResponse.json({ ok: true, id: created?.id, contactValue });
}
