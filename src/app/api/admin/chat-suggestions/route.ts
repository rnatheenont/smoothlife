import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// Managing the questions offered under the AI field.
//
// Gated by "/api/admin/chat-suggestions" -> kb.draft in
// admin-route-permissions.ts: writing the lines a shopper is nudged towards
// is the same job as drafting the knowledge base, and the same people do it.

export type SuggestionRow = {
  id: string;
  text: string;
  source: "admin" | "auto";
  asked_count: number;
  enabled: boolean;
};

/** Long enough to be a real question, short enough to stay a chip. */
const MAX_LEN = 60;

function unauthorised(req: NextRequest) {
  return !verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (unauthorised(req)) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const rows = await supabaseRest<SuggestionRow[]>(
    "chat_question_suggestions?select=id,text,source,asked_count,enabled&order=asked_count.desc,text.asc"
  );
  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: NextRequest) {
  if (unauthorised(req)) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ ok: false, error: "กรุณาพิมพ์คำถาม" }, { status: 400 });
  if (text.length > MAX_LEN) {
    return NextResponse.json({ ok: false, error: `คำถามยาวเกิน ${MAX_LEN} ตัวอักษร` }, { status: 400 });
  }

  try {
    const [row] = await supabaseRest<SuggestionRow[]>("chat_question_suggestions", {
      method: "POST",
      body: JSON.stringify({ text, source: "admin" }),
    });
    return NextResponse.json({ ok: true, row });
  } catch {
    // The unique index is on the trimmed, lower-cased text, so this is the
    // one failure an admin can cause by hand and the one worth naming.
    return NextResponse.json({ ok: false, error: "มีคำถามนี้อยู่แล้ว" }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  if (unauthorised(req)) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.text === "string" && body.text.trim()) patch.text = body.text.trim().slice(0, MAX_LEN);

  const [row] = await supabaseRest<SuggestionRow[]>(`chat_question_suggestions?id=eq.${pgValue(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบคำถามนี้" }, { status: 404 });
  return NextResponse.json({ ok: true, row });
}

export async function DELETE(req: NextRequest) {
  if (unauthorised(req)) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  await supabaseRest(`chat_question_suggestions?id=eq.${pgValue(id)}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}
