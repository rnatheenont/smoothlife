import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Flags a chat conversation for a human to follow up on. This is real,
// actionable data (a row in chat_escalations staff can query) — never a
// fake "connecting you to an agent" promise, since there's no live agent
// inbox wired up yet. Requires login so there's a real way to contact the
// customer back; never touches Shopify.
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

  return NextResponse.json({ ok: true, id: created?.id, contactValue });
}
