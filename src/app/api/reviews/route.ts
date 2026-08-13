import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export type ReviewRow = {
  id: string;
  product_slug: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  created_at: string;
};

function requireUid(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

// Reviews are genuine, user-submitted data (see product_reviews migration) —
// there is deliberately no synthetic/seeded content here. A product with no
// reviews yet returns an empty list; the UI shows an honest empty state
// instead of ever fabricating reviews.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug || !supabaseConfigured()) return NextResponse.json({ reviews: [] });
  const reviews = await supabaseRest<ReviewRow[]>(
    `product_reviews?product_slug=eq.${encodeURIComponent(slug)}&select=id,product_slug,author_name,rating,title,body,created_at&order=created_at.desc`
  );
  return NextResponse.json({ reviews });
}

export async function POST(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { slug, rating, title, body: reviewBody } = body || {};
  const ratingNum = Number(rating);
  if (!slug || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5 || !reviewBody || !String(reviewBody).trim()) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกคะแนนและรายละเอียดรีวิว" }, { status: 400 });
  }

  const [user] = await supabaseRest<{ display_name: string | null }[]>(`users?id=eq.${uid}&select=display_name`);
  const authorName = user?.display_name || "ลูกค้า";

  const [created] = await supabaseRest<ReviewRow[]>("product_reviews", {
    method: "POST",
    body: JSON.stringify({
      user_id: uid,
      product_slug: slug,
      author_name: authorName,
      rating: ratingNum,
      title: title ? String(title).trim() : null,
      body: String(reviewBody).trim(),
    }),
  });
  return NextResponse.json({ ok: true, review: created });
}
