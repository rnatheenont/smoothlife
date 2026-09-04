import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { openConversation, appendMessage } from "@/lib/conversations";

// Leaves a message for the team, and puts it somewhere they actually look:
// a chat_escalations row for the durable record, plus a conversation in the
// unified inbox.
//
// The customer's own note leads, with the chat transcript underneath as
// context. That order matters — staff opening the case should read what the
// person actually wants first, not reconstruct it from a wall of chat they
// weren't part of. Requires login so there's a real way to reply; never
// touches Shopify.
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
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (!transcript && !note) {
    return NextResponse.json({ ok: false, error: "กรุณาพิมพ์ข้อความที่อยากฝากถึงแอดมินค่ะ" }, { status: 400 });
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
      // The note is kept at the top of the stored transcript too, so the
      // durable record reads the same way as the inbox does.
      transcript: [note && `ข้อความจากลูกค้า: ${note}`, transcript]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 8000),
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
      subject: note ? note.slice(0, 120) : "ขอคุยกับทีมงาน (จากแชทน้อง Smoothie)",
    });
    if (conversation) {
      if (note) {
        await appendMessage({
          conversationId: conversation.id,
          senderType: "customer",
          content: note,
        });
      }
      if (transcript) {
        await appendMessage({
          conversationId: conversation.id,
          senderType: "customer",
          content: `— บทสนทนากับน้อง Smoothie ก่อนหน้านี้ —\n${transcript}`,
        });
      }
    }
  } catch (err) {
    console.error("[chat/escalate] escalation saved but inbox handoff failed", err);
  }

  return NextResponse.json({ ok: true, id: created?.id, contactValue });
}
