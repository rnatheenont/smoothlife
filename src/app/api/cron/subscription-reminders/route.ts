import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";

const REMINDER_WINDOW_DAYS = 3;

type DueSubscription = {
  id: string;
  user_id: string;
  product_name: string;
  product_slug: string;
  plan_months: number;
  next_renewal_at: string;
};

// Daily cron (see vercel.json) — the automatic half of "auto subscription":
// there's no real recurring charge to fire, so this is what actually runs
// on its own without the customer doing anything, nudging them to
// repurchase before their current term's supply runs out. Each row is only
// ever reminded once (reminded_at gate) even if this runs more than once
// on the same day.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 200 });
  }

  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const due = await supabaseRest<DueSubscription[]>(
    `subscription_preferences?active=eq.true&reminded_at=is.null&next_renewal_at=lte.${windowEnd}&select=id,user_id,product_name,product_slug,plan_months,next_renewal_at`
  );

  let notified = 0;
  for (const sub of due) {
    await supabaseRest("notifications", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: sub.user_id,
        type: "subscription_renewal",
        title: "การสมัครของคุณใกล้ครบรอบแล้ว",
        body: `${sub.product_name} จะครบรอบ ${sub.plan_months} เดือนเร็วๆ นี้ — สั่งซื้ออีกครั้งเพื่อรับส่วนลดต่อเนื่อง`,
        link: `/product/${sub.product_slug}`,
        metadata: { subscriptionId: sub.id },
      }),
    });
    await supabaseRest(`subscription_preferences?id=eq.${sub.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ reminded_at: new Date().toISOString() }),
    });
    notified++;
  }

  return NextResponse.json({ ok: true, notified });
}
