import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { findPaidOrderForProduct } from "@/lib/shopify-admin";

// 3-tier reward per the loyalty programme handoff doc: a bare star rating
// earns the least, adding real written detail earns more, adding media earns
// the most. Points are only ever an estimate until an admin approves the
// review (see /api/admin/reviews) — this app never credits points for
// unmoderated content.
const REVIEW_MIN_TEXT_LENGTH = 20;
const REVIEW_POINTS: Record<string, number> = {
  star_only: 5,
  star_text: 15,
  star_text_media: 30,
};
const REVIEW_WINDOW_DAYS = 60;

export type ReviewRow = {
  id: string;
  product_slug: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  review_type: string | null;
  status: string;
  created_at: string;
};

function requireUid(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

function reviewType(body: string, mediaUrls: string[]): keyof typeof REVIEW_POINTS {
  const hasText = body.trim().length >= REVIEW_MIN_TEXT_LENGTH;
  if (hasText && mediaUrls.length > 0) return "star_text_media";
  if (hasText) return "star_text";
  return "star_only";
}

// Reviews are genuine, user-submitted data (see product_reviews migration) —
// there is deliberately no synthetic/seeded content here. A product with no
// reviews yet returns an empty list; the UI shows an honest empty state
// instead of ever fabricating reviews. Only approved reviews are public —
// pending_review/rejected rows stay invisible until an admin acts on them.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug || !supabaseConfigured()) return NextResponse.json({ reviews: [] });
  const reviews = await supabaseRest<ReviewRow[]>(
    `product_reviews?product_slug=eq.${encodeURIComponent(slug)}&status=eq.approved&select=id,product_slug,author_name,rating,title,body,review_type,status,created_at&order=created_at.desc`
  );
  return NextResponse.json({ reviews });
}

export async function POST(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { slug, rating, title, body: reviewBody, mediaUrls: rawMediaUrls } = body || {};
  const ratingNum = Number(rating);
  const text = String(reviewBody || "").trim();
  const mediaUrls = Array.isArray(rawMediaUrls) ? rawMediaUrls.filter((u) => typeof u === "string").slice(0, 6) : [];
  if (!slug || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ ok: false, error: "กรุณาให้คะแนนดาวสินค้านี้ครับ" }, { status: 400 });
  }

  const [user] = await supabaseRest<{ display_name: string | null; shopify_customer_id: string | null }[]>(
    `users?id=eq.${uid}&select=display_name,shopify_customer_id`
  );
  const authorName = user?.display_name || "ลูกค้า";

  // Reviews only count (and only earn points) when tied to a real, paid
  // order for this product — keeps reviews genuine instead of open to
  // anyone typing anything, same "no fabricated data" bar as the rest of
  // this feature. Applies to every tier, including star-only.
  const order = user?.shopify_customer_id ? await findPaidOrderForProduct(user.shopify_customer_id, String(slug)) : null;
  if (!order) {
    return NextResponse.json(
      { ok: false, error: "ต้องซื้อสินค้านี้และชำระเงินสำเร็จก่อนจึงจะรีวิวได้ครับ" },
      { status: 403 }
    );
  }
  const daysSincePaid = (Date.now() - new Date(order.paidAt).getTime()) / 86_400_000;
  if (daysSincePaid > REVIEW_WINDOW_DAYS) {
    return NextResponse.json(
      { ok: false, error: `รีวิวได้ภายใน ${REVIEW_WINDOW_DAYS} วันหลังสั่งซื้อสำเร็จครับ (คำสั่งซื้อนี้เกินกำหนดแล้ว)` },
      { status: 403 }
    );
  }

  const existingReview = await supabaseRest<{ id: string }[]>(
    `product_reviews?user_id=eq.${uid}&product_slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`
  );
  if (existingReview.length > 0) {
    return NextResponse.json({ ok: false, error: "คุณรีวิวสินค้านี้ไปแล้วครับ" }, { status: 409 });
  }

  const type = reviewType(text, mediaUrls);
  const points = REVIEW_POINTS[type];

  const [created] = await supabaseRest<ReviewRow[]>("product_reviews", {
    method: "POST",
    body: JSON.stringify({
      user_id: uid,
      product_slug: slug,
      author_name: authorName,
      rating: ratingNum,
      title: title ? String(title).trim() : null,
      body: text,
      order_id: order.orderId,
      review_type: type,
      media_urls: mediaUrls,
      points_awarded: points,
      status: "pending_review",
    }),
  });

  // Points are credited on approval (see /api/admin/reviews/[id]), not here —
  // matches the plan's "แต้มเข้าหลัง approve เท่านั้น" rule.
  return NextResponse.json({ ok: true, review: created, pointsAwarded: points, pendingApproval: true });
}
