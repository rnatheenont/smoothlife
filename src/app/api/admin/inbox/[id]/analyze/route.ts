import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { logAiUsage } from "@/lib/ai-usage";
import { ConversationRow } from "@/lib/conversations";

// Reads a thread and says what it is about, what the customer wants, and how
// they sound — so staff opening a long case see the shape of it before reading
// forty messages to find out.
//
// It proposes and never decides. Nothing here sets urgency: it can say the
// case looks like one worth flagging, and a person presses the button. Mood is
// the reason for that line — being told a customer is angry when they are
// merely terse is a judgement that damages a real relationship, and the same
// discipline the product-content editor uses for "has a verified source"
// applies with more force to something said about a person.
//
// Raw fetch, effort "low", usage logged: the shape every other AI call in this
// codebase uses (seo/suggest, product-content/suggest, skin-coach).
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const MOODS = ["neutral", "happy", "confused", "annoyed", "angry"] as const;
const CONFIDENCE = ["low", "medium", "high"] as const;

const SYSTEM = `คุณเป็นผู้ช่วยของทีมงานฝ่ายบริการลูกค้า Smoothlife.com
หน้าที่ของคุณคืออ่านบทสนทนาแล้วสรุปให้ทีมงานเห็นภาพเร็วที่สุด ไม่ใช่ตอบลูกค้า

กติกา:
- ใช้เฉพาะสิ่งที่ปรากฏในบทสนทนาเท่านั้น ห้ามเดาเรื่องที่ลูกค้าไม่ได้พูด
- "mood" คืออารมณ์ของลูกค้าจากถ้อยคำจริง ไม่ใช่จากหัวข้อที่คุย
  ลูกค้าพิมพ์สั้นหรือพิมพ์ห้วน ไม่ได้แปลว่าโกรธ ถ้าไม่ชัดให้ตอบ neutral
- "confidence" ให้ตอบตามความชัดของหลักฐานในบทสนทนา ข้อความน้อยหรือกำกวมให้ตอบ low
- "suggestUrgent" ให้เป็น true เฉพาะเมื่อมีสัญญาณชัด เช่น ลูกค้าไม่พอใจชัดเจน
  แจ้งปัญหาสินค้าที่อาจกระทบร่างกาย ขอคืนเงิน หรือรอคำตอบมานานแล้ว
- ตอบกลับเป็น JSON อย่างเดียว ห้ามมีข้อความอื่นนอก JSON
- ทุก field เป็นภาษาไทย ยกเว้น mood กับ confidence ที่ต้องเป็นค่าที่กำหนดไว้

รูปแบบ:
{"topic":"...","need":"...","mood":"neutral|happy|confused|annoyed|angry","confidence":"low|medium|high","suggestUrgent":true,"reason":"..."}`;

type Insight = {
  topic: string;
  need: string;
  mood: (typeof MOODS)[number];
  confidence: (typeof CONFIDENCE)[number];
  suggestUrgent: boolean;
  reason: string;
};

function parseInsight(raw: string): Insight | null {
  // The model is told to answer in JSON and usually does; a stray ```json
  // fence is the one thing worth forgiving before giving up.
  const text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const mood = MOODS.find((m) => m === value.mood);
  const confidence = CONFIDENCE.find((c) => c === value.confidence);
  const topic = str(value.topic, 300);
  if (!topic || !mood || !confidence) return null;
  return {
    topic,
    need: str(value.need, 300),
    mood,
    confidence,
    suggestUrgent: value.suggestUrgent === true,
    reason: str(value.reason, 300),
  };
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

  // Drafts excluded: a suggestion nobody sent is not something the customer
  // ever saw, and reading it back as if it were part of the conversation would
  // have the assistant summarising its own unused words.
  const messages = await supabaseRest<{ sender_type: string; content: string }[]>(
    `conversation_messages?conversation_id=eq.${pgValue(params.id)}&is_draft=eq.false` +
      `&select=sender_type,content&order=created_at.desc&limit=40`
  );
  if (messages.length === 0) {
    return NextResponse.json({ ok: false, error: "ยังไม่มีข้อความให้วิเคราะห์" }, { status: 400 });
  }

  const transcript = [...messages]
    .reverse()
    .map((m) => `${m.sender_type === "customer" ? "ลูกค้า" : m.sender_type === "staff" ? "ทีมงาน" : "AI"}: ${m.content}`)
    .join("\n");

  const started = Date.now();
  let data: { content?: { type?: string; text?: string }[]; usage?: unknown };
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
        max_tokens: 500,
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [{ role: "user", content: `บทสนทนา:\n\n${transcript}\n\nสรุปตามรูปแบบ JSON ที่กำหนด` }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("[admin/inbox/analyze] anthropic error", res.status, detail.slice(0, 300));
      return NextResponse.json({ ok: false, error: "วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
    }
    data = await res.json();
  } catch (err) {
    console.error("[admin/inbox/analyze] failed", err);
    return NextResponse.json({ ok: false, error: "วิเคราะห์ไม่สำเร็จ" }, { status: 502 });
  }

  const text = (data?.content ?? [])
    .filter((b) => b?.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  const insight = parseInsight(text);

  await logAiUsage({
    feature: "inbox-analyze",
    model: MODEL,
    outcome: insight ? "ok" : "unparsable",
    usage: data?.usage as never,
    durationMs: Date.now() - started,
  }).catch(() => {});

  if (!insight) {
    console.error("[admin/inbox/analyze] unparsable reply", text.slice(0, 300));
    return NextResponse.json({ ok: false, error: "อ่านผลวิเคราะห์ไม่ออก กรุณาลองใหม่" }, { status: 502 });
  }

  const session = getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  const row = {
    conversation_id: conversation.id,
    topic: insight.topic,
    need: insight.need,
    mood: insight.mood,
    confidence: insight.confidence,
    suggest_urgent: insight.suggestUrgent,
    reason: insight.reason,
    // A fresh reading, so whatever a person said about the last one no longer
    // applies to it.
    staff_verdict: null,
    analyzed_at: new Date().toISOString(),
    analyzed_by: session?.userId ?? null,
  };
  await supabaseRest("conversation_insights?on_conflict=conversation_id", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row),
  }).catch((err) => console.error("[admin/inbox/analyze] could not save insight", err));

  return NextResponse.json({ ok: true, insight: { ...insight, analyzedAt: row.analyzed_at, staffVerdict: null } });
}

/** What a person made of the reading — kept so "how often is it wrong" is a
 *  question the data can answer later, rather than a feeling. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const verdict = body?.verdict === "agree" || body?.verdict === "disagree" ? body.verdict : null;
  if (!verdict) return NextResponse.json({ ok: false, error: "ค่าไม่ถูกต้อง" }, { status: 400 });

  await supabaseRest(`conversation_insights?conversation_id=eq.${pgValue(params.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ staff_verdict: verdict }),
  });
  return NextResponse.json({ ok: true });
}
