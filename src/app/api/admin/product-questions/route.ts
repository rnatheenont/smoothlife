import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// Questions customers asked on a product page.
//
// They have had nowhere to be answered: the dashboard card counting them
// linked to /admin/inbox, which does not handle them, so three of them have
// been sitting unanswered since the feature shipped. The customer who asked
// is waiting on the product page where they asked.
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const answered = req.nextUrl.searchParams.get("answered") === "1";
  const filter = answered ? "answer=not.is.null" : "answer=is.null";

  const questions = await supabaseRest<
    {
      id: string;
      product_slug: string;
      author_name: string | null;
      question: string;
      answer: string | null;
      created_at: string;
    }[]
  >(`product_questions?${filter}&select=id,product_slug,author_name,question,answer,created_at&order=created_at.asc&limit=200`);

  return NextResponse.json({ ok: true, questions });
}
