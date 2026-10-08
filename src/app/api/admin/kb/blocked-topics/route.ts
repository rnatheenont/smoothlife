import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { BLOCKED_TOPIC_COLUMNS, type KbBlockedTopic } from "@/lib/kb-blocked-topics";

// Admin: the topics the assistant must refuse.
//
// kb_articles says what the assistant may answer from; this says what it must
// not answer at all, whatever it finds. See lib/kb-blocked-topics.ts for why
// these are not articles.
export const dynamic = "force-dynamic";

const MAX_TOPIC = 160;
const MAX_REPLY = 400;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}
function notReady() {
  return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return notReady();
  const rows = await supabaseRest<KbBlockedTopic[]>(
    `kb_blocked_topics?select=${BLOCKED_TOPIC_COLUMNS}&order=enabled.desc,created_at.desc`
  );
  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return notReady();

  const body = await req.json().catch(() => null);
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  if (!topic) return NextResponse.json({ ok: false, error: "กรุณาระบุเรื่องที่ห้ามตอบ" }, { status: 400 });
  if (topic.length > MAX_TOPIC) {
    return NextResponse.json({ ok: false, error: `เรื่องที่ห้ามตอบยาวเกิน ${MAX_TOPIC} ตัวอักษร` }, { status: 400 });
  }
  const reply = typeof body?.reply === "string" ? body.reply.trim().slice(0, MAX_REPLY) : "";

  try {
    const [row] = await supabaseRest<KbBlockedTopic[]>("kb_blocked_topics", {
      method: "POST",
      body: JSON.stringify({ topic, reply, note: typeof body?.note === "string" ? body.note.slice(0, 400) : null }),
    });
    return NextResponse.json({ ok: true, row });
  } catch {
    // The unique index is on the trimmed, lower-cased topic — the one failure
    // an admin can cause by hand, and the one worth naming.
    return NextResponse.json({ ok: false, error: "มีเรื่องนี้อยู่ในรายการแล้ว" }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return notReady();

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.topic === "string" && body.topic.trim()) patch.topic = body.topic.trim().slice(0, MAX_TOPIC);
  if (typeof body.reply === "string") patch.reply = body.reply.trim().slice(0, MAX_REPLY);
  if (typeof body.note === "string") patch.note = body.note.slice(0, 400);

  const [row] = await supabaseRest<KbBlockedTopic[]>(`kb_blocked_topics?id=eq.${pgValue(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });
  return NextResponse.json({ ok: true, row });
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return notReady();

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  await supabaseRest(`kb_blocked_topics?id=eq.${pgValue(id)}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}
