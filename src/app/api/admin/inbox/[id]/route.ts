import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { getProductBySlug } from "@/data/products";
import { translateForCustomer } from "@/lib/reply-translate";
import { appendMessage, transcriptKeyFor, ConversationRow } from "@/lib/conversations";
import { clearInboxAlert } from "@/lib/inbox-alert";
import { lineImageMessage, lineTextMessage, linePushConfigured, pushLineMessages, type LineMessage } from "@/lib/line-push";
import {
  signedAttachmentUrl,
  deleteAttachmentsForConversation,
  uploadAttachment,
  MAX_ATTACHMENT_BYTES,
  LINE_ATTACHMENT_TTL_SECONDS,
} from "@/lib/chat-attachments";
import { withCustomImages } from "@/lib/product-images";

// One conversation: the whole thread plus the customer context staff would
// otherwise go and look up in three other screens.

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  // The thread is worth fetching even if the conversation row turns out to be
  // missing: one wasted query on a 404 costs less than a round trip on every
  // open that succeeds.
  const [[conversation], messages, [insight]] = await Promise.all([
    supabaseRest<ConversationRow[]>(`conversations?id=eq.${pgValue(params.id)}&select=*&limit=1`),
    supabaseRest<
      { id: string; sender_type: string; content: string; is_draft: boolean; created_at: string; attachment_path: string | null; delivered_content: string | null; translation: string | null }[]
    >(
      `conversation_messages?conversation_id=eq.${pgValue(params.id)}&select=id,sender_type,content,is_draft,created_at,attachment_path,delivered_content,translation&order=created_at.asc&limit=200`
    ),
    // Whatever the assistant last made of this thread, if anyone has asked it
    // (see ./analyze). Nothing runs it here — the reading is shown, not taken.
    supabaseRest<
      {
        topic: string | null; need: string | null; mood: string | null; confidence: string | null;
        suggest_urgent: boolean; reason: string | null; staff_verdict: string | null; analyzed_at: string;
      }[]
    >(
      `conversation_insights?conversation_id=eq.${pgValue(params.id)}` +
        `&select=topic,need,mood,confidence,suggest_urgent,reason,staff_verdict,analyzed_at&limit=1`
    ).catch(() => []),
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
    const [[user], [loyalty], [points], [email], subscriptions, skinScans] = await Promise.all([
      supabaseRest<{ id: string; display_name: string | null; phone: string | null; shopify_customer_id: string | null }[]>(
        `users?id=eq.${uid}&select=id,display_name,phone,shopify_customer_id&limit=1`
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
      // Saved Skin Coach scans: what their skin looked like to the scan, so a
      // "what should I use" question can be answered with it in view.
      supabaseRest<unknown[]>(
        `skin_scans?user_id=eq.${uid}&order=scanned_at.desc&limit=4&select=id,scanned_at,angles,skin_age,age_range,skin_type,main_concern,metrics`
      ).catch(() => []),
    ]);

    customer = {
      name: user?.display_name ?? null,
      phone: user?.phone ?? null,
      email: email?.provider_uid ?? null,
      // Carried so the orders tab knows whether it can go straight to Shopify
      // or has to search by email/phone first (see ./orders).
      shopifyCustomerId: user?.shopify_customer_id ?? null,
      tier: loyalty?.current_tier ?? null,
      spend12mo: loyalty?.rolling_12mo_spend ?? null,
      points: points?.balance ?? null,
      subscriptions,
      skinScans,
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

  // Products Smoothie recommended, resolved here rather than in the browser:
  // the catalogue is a megabyte, and the admin bundle should not carry it just
  // to draw a few cards. Staff need to see what was recommended — a bare
  // [[slug]] tells them nothing about which product the customer was shown.
  // Newest first, because the product under discussion is the one just
  // mentioned, not the one mentioned forty messages ago.
  const discussed: string[] = [];
  for (const m of [...messages].reverse()) {
    for (const match of m.content.matchAll(/\[\[([a-z0-9-]+)\]\]/gi)) {
      if (!discussed.includes(match[1])) discussed.push(match[1]);
    }
  }

  // What they had open on the site while they were typing. Every web message
  // has carried this since the widget shipped — it was only ever read when a
  // case was escalated, so staff could not see it while answering, which is
  // the moment it is worth something.
  const viewedRows = await supabaseRest<{ viewing_product_slug: string | null }[]>(
    `chat_messages?session_key=eq.${pgValue(transcriptKeyFor(conversation))}` +
      `&viewing_product_slug=not.is.null&select=viewing_product_slug&order=created_at.desc&limit=60`
  ).catch((): { viewing_product_slug: string | null }[] => []);
  const viewed: string[] = [];
  for (const r of viewedRows) {
    const slug = r.viewing_product_slug;
    if (slug && !discussed.includes(slug) && !viewed.includes(slug)) viewed.push(slug);
  }

  const productCards: Record<
    string,
    { name: string; image: string; price: number; compareAtPrice?: number; inStock: boolean }
  > = {};
  // Staff are looking at the same product the customer is: resolved through
  // the overlay so the thumbnail in the thread matches the product page.
  const cardProducts = await withCustomImages(
    [...discussed, ...viewed]
      .map((slug) => getProductBySlug(slug))
      .filter((p): p is NonNullable<typeof p> => Boolean(p)),
  );
  for (const product of cardProducts) {
    productCards[product.slug] = {
      name: product.name,
      image: product.image,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      inStock: product.inStock,
    };
  }

  // A person opening the thread is what "read" means here — not the screen
  // refreshing itself. The inbox re-reads whatever is on screen every five
  // seconds, and while that counted as reading, a case somebody left open on
  // a second monitor could never show as unread to anyone: the customer wrote,
  // the poll marked it read, and the badge stayed at zero. The poll asks with
  // read=0; everything a person does leaves it off and still marks it.
  //
  // Fire-and-forget: a failed marker should leave the badge up, never block
  // the thread from loading.
  if (req.nextUrl.searchParams.get("read") !== "0") {
    supabaseRest(`conversations?id=eq.${pgValue(params.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ staff_read_at: new Date().toISOString() }),
    }).catch((err) => console.error("[admin/inbox] could not mark read", err));
  }

  return NextResponse.json({
    ok: true,
    conversation,
    messages: withUrls,
    customer,
    products: productCards,
    insight: insight
      ? {
          topic: insight.topic,
          need: insight.need,
          mood: insight.mood,
          confidence: insight.confidence,
          suggestUrgent: insight.suggest_urgent,
          reason: insight.reason,
          staffVerdict: insight.staff_verdict,
          analyzedAt: insight.analyzed_at,
        }
      : null,
    discussedSlugs: discussed.filter((s) => productCards[s]),
    viewedSlugs: viewed.filter((s) => productCards[s]),
  });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    // A closed case is no longer waiting for anyone. Forgetting it here is
    // what lets the same conversation raise a fresh alert if the customer
    // comes back and it falls behind again.
    await clearInboxAlert(params.id);
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  // Set when staff confirmed (and possibly edited) a translation preview
  // first — that exact text is what goes out, so this reply is never
  // translated a second time independently of what staff actually approved.
  const deliveredOverride = typeof body.deliveredOverride === "string" ? body.deliveredOverride.trim() : "";
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

  // Web and LINE have a delivery path; anything else is refused outright,
  // because a reply stored but never delivered would show as "sent" to staff
  // while the customer waits forever.
  if (conversation.channel !== "web" && conversation.channel !== "line") {
    return NextResponse.json(
      { ok: false, error: `ยังส่งข้อความกลับช่องทาง ${conversation.channel} ไม่ได้ (ยังไม่ได้เชื่อมต่อ)` },
      { status: 501 }
    );
  }
  if (conversation.channel === "line" && !linePushConfigured()) {
    return NextResponse.json(
      { ok: false, error: "ยังตอบกลับทาง LINE ไม่ได้ — ยังไม่ได้ตั้งค่า LINE_MESSAGING_ACCESS_TOKEN" },
      { status: 503 }
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

  const transcriptKey = transcriptKeyFor(conversation);

  // What the customer will read. Staff answer in Thai; someone who wrote in
  // English or Japanese should not have to translate their own support reply.
  // Only when it differs — a staff member who already answered in their
  // language gets delivered verbatim.
  let delivered: string | null = null;
  if (deliveredOverride) {
    // Staff already saw this exact text in the preview panel and approved
    // it — translating again here could silently produce something slightly
    // different from what they confirmed.
    delivered = deliveredOverride !== content ? deliveredOverride : null;
  } else if (content) {
    // Read from chat_messages, not the inbox copy. Rows filed there as
    // "customer" include things the customer never typed — our own
    // "— เรื่องใหม่จากลูกค้า —" divider, and the request summary Smoothie writes
    // in Thai when she hands over — so a customer writing in English looked
    // like a Thai speaker and the reply went out untranslated. role='user' is
    // only ever their own words.
    const prior = await supabaseRest<{ content: string }[]>(
      `chat_messages?session_key=eq.${pgValue(transcriptKey)}&role=eq.user` +
        `&select=content&order=created_at.desc&limit=6`
    ).catch((): { content: string }[] => []);
    delivered = await translateForCustomer({
      staffReply: content,
      customerMessages: prior
        .map((m) => m.content.replace(/^\[\[PHOTO\]\]\s*/, "").trim())
        .filter((c) => c && c !== "(ส่งรูป)")
        .reverse(),
    });
  }

  // LINE is delivered before the thread is written, unlike web: a push can be
  // refused — the customer blocked the OA, or the monthly quota is spent — and
  // a reply recorded as sent that never arrived is worse than an error staff
  // can see and act on.
  if (conversation.channel === "line") {
    const messages: LineMessage[] = [];
    if (attachmentPath) {
      // LINE renders the photo from a URL it fetches itself, so the private
      // bucket has to be opened for exactly this file, for exactly as long as
      // the file exists (see LINE_ATTACHMENT_TTL_SECONDS).
      const url = await signedAttachmentUrl(attachmentPath, LINE_ATTACHMENT_TTL_SECONDS);
      if (!url) {
        return NextResponse.json(
          { ok: false, error: "เตรียมลิงก์รูปสำหรับส่งเข้า LINE ไม่สำเร็จ" },
          { status: 502 }
        );
      }
      messages.push(lineImageMessage(url));
    }
    if (content) messages.push(lineTextMessage(delivered ?? content));

    const sent = await pushLineMessages(conversation.channel_user_id, messages);
    if (!sent) {
      return NextResponse.json(
        { ok: false, error: "ส่งข้อความไปยัง LINE ไม่สำเร็จ — ลูกค้าอาจบล็อก OA ไว้ หรือโควตาข้อความของเดือนนี้หมดแล้ว" },
        { status: 502 }
      );
    }
  }

  await appendMessage({
    conversationId: conversation.id,
    senderType: "staff",
    content,
    attachmentPath,
    deliveredContent: delivered,
  });

  // For web this IS the delivery: the customer's chat widget reads its history
  // out of chat_messages keyed by session_key, so writing the reply there is
  // what puts it on their screen. For LINE the message has already gone out
  // above, and this keeps the transcript whole — the webhook replays these
  // rows as the conversation's memory, so without it Smoothie would pick the
  // thread back up knowing nothing of what staff had just told the customer.
  await supabaseRest("chat_messages", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      session_key: transcriptKey,
      user_id: conversation.user_id,
      role: "assistant",
      // Marks it as a person for the customer's panel. The role column only
      // allows user/assistant — that same value is replayed to Anthropic as
      // conversation history — so who sent it rides alongside instead.
      from_staff: true,
      content: delivered ?? content,
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
  // Answered, so it stops being one of the cases waiting for an answer.
  await clearInboxAlert(conversation.id);

  return NextResponse.json({ ok: true });
}
