import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { ConversationRow } from "@/lib/conversations";

// Asks the AI for a reply staff can edit and send (plan §7.3). Returns the
// text rather than storing it: a draft nobody sent is scratch work, and
// persisting every rejected suggestion would bury the real thread.
//
// Deliberately NOT the customer-facing Smoothie prompt. That one sells; this
// one writes what a support colleague would write, and is told plainly that a
// human is about to check it — an assistant that invents a refund policy here
// costs more than one that says "I don't know".
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const SYSTEM = `คุณเป็นผู้ช่วยของทีมงานฝ่ายบริการลูกค้า Smoothlife.com (ร้านสุขภาพและความงาม)
หน้าที่ของคุณคือ "ร่าง" คำตอบให้ทีมงานตรวจก่อนส่งจริง ไม่ใช่ส่งเอง

กติกา:
- ตอบเป็นภาษาไทย สุภาพ กระชับ เหมือนแอดมินร้านคุยกับลูกค้า ไม่ใช่หุ่นยนต์
- ใช้เฉพาะข้อมูลที่ปรากฏในบทสนทนาและข้อมูลลูกค้าที่ให้มาเท่านั้น
- ถ้าข้อมูลไม่พอตอบ ให้ร่างเป็นคำถามกลับเพื่อขอข้อมูลที่ขาด อย่าเดา
- ห้ามสัญญาเรื่องเงิน การคืนสินค้า ส่วนลด หรือกำหนดเวลาจัดส่ง ถ้าไม่มีข้อมูลยืนยันในบทสนทนา
- ถ้าเป็นเรื่องที่ต้องตรวจสอบก่อน ให้ร่างว่าจะตรวจสอบและติดต่อกลับ
- ตอบกลับมาเป็นข้อความคำตอบล้วน ๆ ไม่ต้องมีคำนำหรือคำอธิบายว่านี่คือร่าง`;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" }, { status: 503 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const [conversation] = await supabaseRest<ConversationRow[]>(
    `conversations?id=eq.${pgValue(params.id)}&select=*&limit=1`
  );
  if (!conversation) return NextResponse.json({ ok: false, error: "ไม่พบบทสนทนานี้" }, { status: 404 });

  const messages = await supabaseRest<{ sender_type: string; content: string }[]>(
    `conversation_messages?conversation_id=eq.${pgValue(params.id)}&is_draft=eq.false` +
      `&select=sender_type,content&order=created_at.asc&limit=40`
  );
  if (messages.length === 0) {
    return NextResponse.json({ ok: false, error: "ยังไม่มีข้อความให้ร่างคำตอบ" }, { status: 400 });
  }

  const transcript = messages
    .map((m) => `${m.sender_type === "customer" ? "ลูกค้า" : m.sender_type === "staff" ? "ทีมงาน" : "AI"}: ${m.content}`)
    .join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM,
        messages: [{ role: "user", content: `บทสนทนาที่ผ่านมา:\n\n${transcript}\n\nร่างคำตอบถัดไปให้ทีมงาน` }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("[admin/inbox/draft] anthropic error", res.status, detail.slice(0, 300));
      return NextResponse.json({ ok: false, error: "ร่างคำตอบไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
    }
    const data = await res.json();
    const draft = (data?.content ?? [])
      .filter((b: { type?: string }) => b?.type === "text")
      .map((b: { text?: string }) => b.text ?? "")
      .join("")
      .trim();
    if (!draft) return NextResponse.json({ ok: false, error: "ร่างคำตอบไม่สำเร็จ" }, { status: 502 });

    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    console.error("[admin/inbox/draft] failed", err);
    return NextResponse.json({ ok: false, error: "ร่างคำตอบไม่สำเร็จ" }, { status: 502 });
  }
}
