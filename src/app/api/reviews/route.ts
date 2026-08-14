import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { hasPaidOrderForProduct } from "@/lib/shopify-admin";

const REVIEW_REWARD_POINTS = 20;

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

  const [user] = await supabaseRest<{ display_name: string | null; shopify_customer_id: string | null }[]>(
    `users?id=eq.${uid}&select=display_name,shopify_customer_id`
  );
  const authorName = user?.display_name || "ลูกค้า";

  // Reviews only count (and only earn points) when tied to a real, paid
  // order for this product — keeps reviews genuine instead of open to
  // anyone typing anything, same "no fabricated data" bar as the rest of
  // this feature.
  const verifiedPurchase = user?.shopify_customer_id
    ? await hasPaidOrderForProduct(user.shopify_customer_id, String(slug))
    : false;
  if (!verifiedPurchase) {
    return NextResponse.json(
      { ok: false, error: "ต้องซื้อสินค้านี้และชำระเงินสำเร็จก่อนจึงจะรีวิวได้ครับ" },
      { status: 403 }
    );
  }

  const existingReview = await supabaseRest<{ id: string }[]>(
    `product_reviews?user_id=eq.${uid}&product_slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`
  );
  if (existingReview.length > 0) {
    return NextResponse.json({ ok: false, error: "คุณรีวิวสินค้านี้ไปแล้วครับ" }, { status: 409 });
  }

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

  await supabaseRest("points_ledger", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: uid,
      delta: REVIEW_REWARD_POINTS,
      reason: "review_reward",
      metadata: { product_slug: slug, review_id: created?.id },
    }),
  });

  return NextResponse.json({ ok: true, review: created, pointsAwarded: REVIEW_REWARD_POINTS });
}
