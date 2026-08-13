import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export type QuestionRow = {
  id: string;
  product_slug: string;
  author_name: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
};

function requireUid(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

// Questions are stored with answer left null until a real staff member
// answers them (no auto-generated answers) — the UI shows a "pending" state
// for unanswered questions rather than ever fabricating a response.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug || !supabaseConfigured()) return NextResponse.json({ questions: [] });
  const questions = await supabaseRest<QuestionRow[]>(
    `product_questions?product_slug=eq.${encodeURIComponent(slug)}&select=id,product_slug,author_name,question,answer,answered_at,created_at&order=created_at.desc`
  );
  return NextResponse.json({ questions });
}

export async function POST(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { slug, question } = body || {};
  if (!slug || !question || !String(question).trim()) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกคำถาม" }, { status: 400 });
  }

  const [user] = await supabaseRest<{ display_name: string | null }[]>(`users?id=eq.${uid}&select=display_name`);
  const authorName = user?.display_name || "ลูกค้า";

  const [created] = await supabaseRest<QuestionRow[]>("product_questions", {
    method: "POST",
    body: JSON.stringify({
      user_id: uid,
      product_slug: slug,
      author_name: authorName,
      question: String(question).trim(),
    }),
  });
  return NextResponse.json({ ok: true, question: created });
}
