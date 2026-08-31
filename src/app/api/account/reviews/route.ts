import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export type MyReviewRow = {
  id: string;
  product_slug: string;
  rating: number;
  title: string | null;
  body: string;
  review_type: string | null;
  points_awarded: number | null;
  status: string;
  created_at: string;
  approved_at: string | null;
};

// A customer's own review history across every product — plan section 7.1
// ("ประวัติรีวิวที่เคยเขียน + สถานะ approve"). Unlike the public per-product
// GET in @/app/api/reviews/route.ts, this returns every status (including
// pending_review/rejected) since it's scoped to the reviewer themselves.
export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }
  const reviews = await supabaseRest<MyReviewRow[]>(
    `product_reviews?user_id=eq.${uid}&select=id,product_slug,rating,title,body,review_type,points_awarded,status,created_at,approved_at&order=created_at.desc`
  );
  return NextResponse.json({ ok: true, reviews });
}
