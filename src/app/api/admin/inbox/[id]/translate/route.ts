import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { translateToThai } from "@/lib/reply-translate";

// Translating one customer message into Thai, when staff ask for it.
//
// On demand rather than on open: most threads are already Thai, and an agent
// who reads English does not need it either — translating every foreign
// message the moment a thread is opened would spend a model call on work
// nobody wanted. The result is stored, so the same message is never paid for
// twice.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const messageId = typeof body?.messageId === "string" ? body.messageId : "";
  if (!messageId) return NextResponse.json({ ok: false, error: "ต้องระบุ messageId" }, { status: 400 });

  const [row] = await supabaseRest<{ id: string; content: string; translation: string | null }[]>(
    `conversation_messages?id=eq.${pgValue(messageId)}&conversation_id=eq.${pgValue(params.id)}` +
      `&select=id,content,translation&limit=1`
  );
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบข้อความนี้" }, { status: 404 });
  if (row.translation) return NextResponse.json({ ok: true, translation: row.translation });

  const result = await translateToThai([{ id: row.id, content: row.content }]);
  const translation = result.get(row.id);
  if (!translation) {
    // Also what comes back when the message was Thai all along, which is not
    // an error worth a red banner — say so plainly.
    return NextResponse.json({ ok: false, error: "แปลไม่สำเร็จ หรือข้อความนี้เป็นภาษาไทยอยู่แล้ว" }, { status: 422 });
  }

  await supabaseRest(`conversation_messages?id=eq.${pgValue(messageId)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ translation }),
  }).catch((err) => console.error("[admin/inbox/translate] could not store", err));

  return NextResponse.json({ ok: true, translation });
}
