import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { appendMessage, ConversationRow } from "@/lib/conversations";
import {
  signedAttachmentUrl,
  deleteAttachmentsForConversation,
  uploadAttachment,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/chat-attachments";

// One conversation: the whole thread plus the customer context staff would
// otherwise go and look up in three other screens.

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  // The thread is worth fetching even if the conversation row turns out to be
  // missing: one wasted query on a 404 costs less than a round trip on every
  // open that succeeds.
  const [[conversation], messages] = await Promise.all([
    supabaseRest<ConversationRow[]>(`conversations?id=eq.${pgValue(params.id)}&select=*&limit=1`),
    supabaseRest<
      { id: string; sender_type: string; content: string; is_draft: boolean; created_at: string; attachment_path: string | null }[]
    >(
      `conversation_messages?conversation_id=eq.${pgValue(params.id)}&select=id,sender_type,content,is_draft,created_at,attachment_path&order=created_at.asc&limit=200`
    ),
  ]);
  if (!conversation) return NextResponse.json({ ok: false, error: "ไม่พบบทสนทนานี้" }, { status: 404 });

  // Everything below is best-effort context: a conversation with an
  // unidentified customer is still perfectly answerable, just with less
  // beside it, so a missing piece must never fail the whole request.
  let customer: Record<string, unknown> | null = null;
  if (conversation.user_id) {
    const uid = pgValue(conversation.user_id);
    // Fired together, not one after another. These are five independent
    // lookups and running them in sequence added most of a second to the only
    // screen staff keep open all day — the customer is not more identified for
    // having been fetched slowly.
    const [[user], [loyalty], [points], [email], subscriptions] = await Promise.all([
      supabaseRest<{ id: string; display_name: string | null; phone: string | null }[]>(
        `users?id=eq.${uid}&select=id,display_name,phone&limit=1`
      ).catch(() => []),
      // Tier lives in user_loyalty.current_tier (maintained by the daily cron);
      // the spendable balance is the points_balance view, the same source
      // /api/account/redeem trusts before letting anyone spend.
      supabaseRest<{ current_tier: string | null; rolling_12mo_spend: number | null }[]>(
        `user_loyalty?user_id=eq.${uid}&select=current_tier,rolling_12mo_spend&limit=1`
      ).catch(() => []),
      supabaseRest<{ balance: number }[]>(
        `points_balance?user_id=eq.${uid}&select=balance&limit=1`
      ).catch(() => []),
      supabaseRest<{ provider_uid: string }[]>(
        `auth_identities?user_id=eq.${uid}&provider=eq.email&select=provider_uid&limit=1`
      ).catch(() => []),
      supabaseRest<
        { id: string; product_name: string; status: string; plan_months: number; next_charge_date: string | null }[]
      >(
        `real_subscriptions?user_id=eq.${uid}&select=id,product_name,status,plan_months,next_charge_date&order=created_at.desc&limit=5`
      ).catch(() => []),
    ]);

    customer = {
      name: user?.display_name ?? null,
      phone: user?.phone ?? null,
      email: email?.provider_uid ?? null,
      tier: loyalty?.current_tier ?? null,
      spend12mo: loyalty?.rolling_12mo_spend ?? null,
      points: points?.balance ?? null,
      subscriptions,
    };
  }

  // Signed per request and short-lived: the bucket is private, so a link
  // copied out of this screen stops working instead of becoming a permanent
  // public address for a customer's photo.
  const withUrls = await Promise.all(
    messages.map(async (m) => ({
      ...m,
      attachmentUrl: m.attachment_path ? await signedAttachmentUrl(m.attachment_path) : null,
    }))
  );

  return NextResponse.json({ ok: true, conversation, messages: withUrls, customer });
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

  // Closing the case is the moment the consent text promised the photos would
  // go. Doing it here rather than on a schedule is what makes that true.
  if (patch.status === "resolved") {
    await deleteAttachmentsForConversation(params.id).catch((err) =>
      console.error("[admin/inbox] could not delete attachments on close", err)
    );
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const imageBase64 = typeof body.image?.base64 === "string" ? body.image.base64 : "";
  const imageType = body.image?.mediaType === "image/png" ? "image/png" : "image/jpeg";
  // A photo on its own is a perfectly good reply — "does it look like this?"
  if (!content && !imageBase64) {
    return NextResponse.json({ ok: false, error: "กรุณาพิมพ์ข้อความหรือแนบรูป" }, { status: 400 });
  }
  if (imageBase64.length > MAX_ATTACHMENT_BYTES * 1.4) {
    return NextResponse.json({ ok: false, error: "รูปใหญ่เกินไป (จำกัด 5 MB)" }, { status: 413 });
  }

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

  // Uploaded before either row is written, so a storage failure never leaves a
  // message claiming a photo that is not there.
  let attachmentPath: string | null = null;
  if (imageBase64) {
    try {
      attachmentPath = await uploadAttachment({
        conversationId: conversation.id,
        bytes: Buffer.from(imageBase64, "base64"),
        contentType: imageType,
      });
    } catch (err) {
      console.error("[admin/inbox] attachment upload failed", err);
      return NextResponse.json({ ok: false, error: "อัปโหลดรูปไม่สำเร็จ" }, { status: 502 });
    }
  }

  await appendMessage({
    conversationId: conversation.id,
    senderType: "staff",
    content,
    attachmentPath,
  });

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
      // Marks it as a person for the customer's panel. The role column only
      // allows user/assistant — that same value is replayed to Anthropic as
      // conversation history — so who sent it rides alongside instead.
      from_staff: true,
      content,
      attachment_path: attachmentPath,
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
