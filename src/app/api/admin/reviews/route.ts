import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export type PendingReviewRow = {
  id: string;
  product_slug: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  review_type: string | null;
  media_urls: string[] | null;
  points_awarded: number | null;
  order_id: string | null;
  status: string;
  created_at: string;
};

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const status = req.nextUrl.searchParams.get("status") || "pending_review";
  const rows = await supabaseRest<PendingReviewRow[]>(
    `product_reviews?status=eq.${encodeURIComponent(status)}&select=id,product_slug,author_name,rating,title,body,review_type,media_urls,points_awarded,order_id,status,created_at&order=created_at.asc`
  );
  return NextResponse.json({ ok: true, reviews: rows });
}
