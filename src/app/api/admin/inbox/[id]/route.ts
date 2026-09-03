import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { appendMessage, ConversationRow } from "@/lib/conversations";

// One conversation: the whole thread plus the customer context staff would
// otherwise go and look up in three other screens.

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const [conversation] = await supabaseRest<ConversationRow[]>(
    `conversations?id=eq.${pgValue(params.id)}&select=*&limit=1`
  );
  if (!conversation) return NextResponse.json({ ok: false, error: "ไม่พบบทสนทนานี้" }, { status: 404 });

  const messages = await supabaseRest<
    { id: string; sender_type: string; content: string; is_draft: boolean; created_at: string }[]
  >(
    `conversation_messages?conversation_id=eq.${pgValue(params.id)}&select=id,sender_type,content,is_draft,created_at&order=created_at.asc&limit=200`
  );

  // Everything below is best-effort context: a conversation with an
  // unidentified customer is still perfectly answerable, just with less
  // beside it, so a missing piece must never fail the whole request.
  let customer: Record<string, unknown> | null = null;
  if (conversation.user_id) {
    const uid = pgValue(conversation.user_id);
    const [user] = await supabaseRest<
      { id: string; first_name: string | null; last_name: string | null; phone: string | null }[]
    >(`users?id=eq.${uid}&select=id,first_name,last_name,phone&limit=1`);
    // Tier lives in user_loyalty.current_tier (maintained by the daily cron);
    // the spendable balance is the points_balance view, the same source
    // /api/account/redeem trusts before letting anyone spend.
    const [loyalty] = await supabaseRest<
      { current_tier: string | null; rolling_12mo_spend: number | null }[]
    >(`user_loyalty?user_id=eq.${uid}&select=current_tier,rolling_12mo_spend&limit=1`).catch(() => []);
    const [points] = await supabaseRest<{ balance: number }[]>(
      `points_balance?user_id=eq.${uid}&select=balance&limit=1`
    ).catch(() => []);
    const [email] = await supabaseRest<{ provider_uid: string }[]>(
      `auth_identities?user_id=eq.${uid}&provider=eq.email&select=provider_uid&limit=1`
    ).catch(() => []);
    const subscriptions = await supabaseRest<
      { id: string; product_name: string; status: string; plan_months: number; next_charge_date: string | null }[]
    >(
      `real_subscriptions?user_id=eq.${uid}&select=id,product_name,status,plan_months,next_charge_date&order=created_at.desc&limit=5`
    ).catch(() => []);

    customer = {
      name: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || null,
      phone: user?.phone ?? null,
      email: email?.provider_uid ?? null,
      tier: loyalty?.current_tier ?? null,
      spend12mo: loyalty?.rolling_12mo_spend ?? null,
      points: points?.balance ?? null,
      subscriptions,
    };
  }

  return NextResponse.json({ ok: true, conversation, messages, customer });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.urgency === "string") patch.urgency = body.urgency;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "ไม่มีข้อมูลให้อัปเดต" }, { status: 400 });
  }

  await supabaseRest(`conversations?id=eq.${pgValue(params.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify(patch),
  });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ ok: false, error: "กรุณาพิมพ์ข้อความ" }, { status: 400 });

  const [conversation] = await supabaseRest<ConversationRow[]>(
    `conversations?id=eq.${pgValue(params.id)}&select=*&limit=1`
  );
  if (!conversation) return NextResponse.json({ ok: false, error: "ไม่พบบทสนทนานี้" }, { status: 404 });

  // Web is the only channel with a delivery path today. Refusing outright for
  // the others is the honest behaviour: a reply stored but never delivered
  // would show as "sent" to staff while the customer waits forever.
  if (conversation.channel !== "web") {
    return NextResponse.json(
      { ok: false, error: `ยังส่งข้อความกลับช่องทาง ${conversation.channel} ไม่ได้ (ยังไม่ได้เชื่อมต่อ)` },
      { status: 501 }
    );
  }

  await appendMessage({ conversationId: conversation.id, senderType: "staff", content });

  // Delivery for web: the customer's chat widget reads its history out of
  // chat_messages keyed by session_key, which for a signed-in customer is
  // their user id — the same value stored as channel_user_id here. Writing the
  // reply there is what actually puts it on their screen.
  await supabaseRest("chat_messages", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      session_key: conversation.channel_user_id,
      user_id: conversation.user_id,
      role: "assistant",
      content,
    }),
  });

  // Answering is the act of taking the case; leaving it in waiting_human would
  // keep it screaming for attention it has already had.
  await supabaseRest(`conversations?id=eq.${pgValue(conversation.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "assigned" }),
  });

  return NextResponse.json({ ok: true });
}
