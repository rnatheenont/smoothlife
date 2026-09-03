import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// Saved replies for the inbox (plan §7.3). Kept as its own resource rather
// than hard-coded so the team can grow the list themselves as the same
// question keeps arriving.

export type CannedResponse = { id: string; title: string; content: string; category: string | null };

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, responses: [] });

  const responses = await supabaseRest<CannedResponse[]>(
    "canned_responses?select=id,title,content,category&order=category.asc,title.asc&limit=200"
  );
  return NextResponse.json({ ok: true, responses });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!title || !content) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อและข้อความ" }, { status: 400 });
  }

  const [created] = await supabaseRest<CannedResponse[]>("canned_responses", {
    method: "POST",
    body: JSON.stringify({
      title: title.slice(0, 120),
      content: content.slice(0, 4000),
      category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : null,
    }),
  });
  return NextResponse.json({ ok: true, response: created });
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });

  await supabaseRest(`canned_responses?id=eq.${pgValue(id)}`, { method: "DELETE", returning: false });
  return NextResponse.json({ ok: true });
}
