import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import type { PendingReviewRow } from "../route";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

// Approve credits the review's pre-computed points_awarded to the ledger —
// this is the only place review points actually get credited, matching the
// "แต้มเข้าหลัง approve เท่านั้น" rule. Reject leaves the ledger untouched.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ ok: false, error: "action ต้องเป็น approve หรือ reject" }, { status: 400 });
  }

  const [review] = await supabaseRest<(PendingReviewRow & { user_id: string })[]>(
    `product_reviews?id=eq.${pgValue(params.id)}&status=eq.pending_review&select=id,user_id,product_slug,points_awarded,review_type`
  );
  if (!review) return NextResponse.json({ ok: false, error: "ไม่พบรีวิวที่รออนุมัติรายการนี้" }, { status: 404 });

  if (action === "reject") {
    await supabaseRest(`product_reviews?id=eq.${pgValue(params.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "rejected" }),
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  await supabaseRest(`product_reviews?id=eq.${pgValue(params.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "approved", approved_at: new Date().toISOString() }),
  });

  const points = review.points_awarded ?? 0;
  if (points > 0) {
    await supabaseRest("points_ledger", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: review.user_id,
        delta: points,
        reason: "review_reward",
        metadata: { product_slug: review.product_slug, review_id: review.id, review_type: review.review_type },
      }),
    });
    await supabaseRest("notifications", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: review.user_id,
        type: "review_approved",
        title: "รีวิวของคุณได้รับการอนุมัติแล้ว",
        body: `ได้รับ ${points} คะแนนจากรีวิวสินค้า`,
        link: "/account/points",
        metadata: { product_slug: review.product_slug, review_id: review.id },
      }),
    });
  }

  return NextResponse.json({ ok: true, status: "approved", pointsCredited: points });
}
