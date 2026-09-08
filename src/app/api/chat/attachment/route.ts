import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { appendMessage, ConversationRow } from "@/lib/conversations";
import { uploadAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/chat-attachments";

// Accepts a photo *only* into a conversation a member of staff is handling.
//
// The narrowness is the point. A customer talking to the AI consented to their
// photo not being stored, and this route must never be the thing that quietly
// breaks that promise — so it refuses unless a person has actually taken the
// case, which is the only situation the second consent covers.

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
    // No open case means the AI is answering, and the AI path does not store
    // photos. Refusing is the correct behaviour, not a failure.
    return NextResponse.json(
      { ok: false, error: "ยังไม่มีเคสที่ทีมงานดูแลอยู่ — รูปจะถูกส่งให้ AI ดูชั่วคราวเท่านั้น" },
      { status: 409 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  const caption = typeof form?.get("caption") === "string" ? (form.get("caption") as string).trim() : "";
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "กรุณาแนบรูป" }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกินไป" }, { status: 400 });
  }

  try {
    const path = await uploadAttachment({
      conversationId: conversation.id,
      bytes: await file.arrayBuffer(),
      contentType: file.type === "image/png" ? "image/png" : "image/jpeg",
    });
    await appendMessage({
      conversationId: conversation.id,
      senderType: "customer",
      content: caption || "(ส่งรูป)",
      attachmentPath: path,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[chat/attachment] upload failed", err);
    return NextResponse.json({ ok: false, error: "อัปโหลดรูปไม่สำเร็จ" }, { status: 502 });
  }
}
