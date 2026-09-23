import { createHmac, timingSafeEqual } from "crypto";
import { after, NextRequest } from "next/server";
import { POST as chatPost } from "@/app/api/chat/route";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { splitMarker } from "@/lib/chat-markers";
import {
  hasOpenCase,
  isHumanHandling,
  openConversation,
  appendMessage,
  recordCustomerMessage,
} from "@/lib/conversations";
import { lineOpenLink, pushLineText, replyLineText, startLineLoading } from "@/lib/line-push";
import { getProductBySlug } from "@/data/products";
import { SITE_URL } from "@/lib/site-url";

// The LINE Official Account's inbound webhook: customers chat in LINE and
// น้อง Smoothie answers, through exactly the same pipeline as the website's
// chat panel (api/chat) rather than a second, quietly diverging assistant.
//
// LINE is therefore a transport, not a product: this file verifies the
// signature, turns an event into a call on that pipeline, and turns the answer
// back into a LINE message. Everything with an opinion in it — the system
// prompt, product search, the knowledge base, the handover rules — stays in
// one place.
//
// Handover is preserved: once a member of staff has taken the conversation in
// the unified inbox, the bot says nothing at all here. Two voices answering
// one question, disagreeing, is worse for a customer than a short wait.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The answer is produced after the 200 (see `after` below), and that work
// still runs on this function's clock.
export const maxDuration = 60;

type LineSource = { type: string; userId?: string };
type LineEvent = {
  type: string;
  webhookEventId?: string;
  replyToken?: string;
  source?: LineSource;
  message?: { id: string; type: string; text?: string };
};

/**
 * Verifies the event really came from LINE.
 *
 * The secret is the **Messaging API** channel's, which is not
 * LINE_CHANNEL_SECRET: that one belongs to the LINE *Login* channel used for
 * sign-in. They are different channels under the same provider, and signing
 * with the wrong one rejects every genuine event.
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET?.trim();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// LINE redelivers an event when a webhook is slow to answer, and this one
// answers before the AI has finished. Remembering the ids we have already
// taken on stops a retry becoming a second, duplicate reply. Per instance and
// deliberately small: it is a duplicate guard, not storage.
const seenEvents = new Set<string>();
function alreadyHandled(id: string | undefined): boolean {
  if (!id) return false;
  if (seenEvents.has(id)) return true;
  if (seenEvents.size > 500) seenEvents.clear();
  seenEvents.add(id);
  return false;
}

/** The site account this LINE user signed in with, if they ever have. */
async function siteUserFor(lineUserId: string): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  try {
    const [row] = await supabaseRest<{ user_id: string }[]>(
      `auth_identities?provider=eq.line&provider_uid=eq.${pgValue(lineUserId)}&select=user_id&limit=1`
    );
    return row?.user_id ?? null;
  } catch (err) {
    console.error("[line-webhook] identity lookup failed", err);
    return null;
  }
}

/**
 * The last few turns, so the conversation has a memory.
 *
 * Read from chat_messages — the same table the web panel replays on reload —
 * because the pipeline expects the client to bring the history with it. LINE
 * has no client to hold it, so the webhook fetches it on the customer's behalf.
 */
async function recentTurns(sessionKey: string): Promise<{ role: "user" | "assistant"; content: string }[]> {
  if (!supabaseConfigured()) return [];
  try {
    const rows = await supabaseRest<{ role: "user" | "assistant"; content: string }[]>(
      `chat_messages?session_key=eq.${encodeURIComponent(sessionKey)}&select=role,content&order=created_at.desc&limit=11`
    );
    return rows.reverse().filter((m) => m.content?.trim());
  } catch (err) {
    console.error("[line-webhook] history fetch failed", err);
    return [];
  }
}

/**
 * Runs one turn through the website's chat pipeline.
 *
 * Called in-process rather than over HTTP: it is the same deployment, and a
 * self-request would have to survive deployment protection and a second cold
 * start for no gain. A session cookie is minted only when this LINE user is a
 * known customer, which is what lets Smoothie see their orders and tier; the
 * signature check above is what makes that identity trustworthy.
 */
async function askSmoothie(opts: {
  lineUserId: string;
  uid: string | null;
  sessionKey: string;
  text: string;
}): Promise<string> {
  const history = await recentTurns(opts.sessionKey);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.uid) headers.cookie = `${SESSION_COOKIE}=${createSessionToken(opts.uid)}`;

  const req = new NextRequest(`${SITE_URL}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [...history, { role: "user", content: opts.text }],
      lang: "th",
      // Keys the transcript and the rate limit for a customer who has never
      // signed in; a signed-in one is keyed by their user id, so the LINE chat
      // and the website chat are one conversation rather than two.
      anonId: `line:${opts.lineUserId}`,
      channel: "line",
      channelUserId: opts.lineUserId,
    }),
  });
  const res = await chatPost(req);
  return await res.text();
}

/**
 * Smoothie's answer as a LINE message.
 *
 * Product recommendations arrive as `[[slug]]`, which the website turns into a
 * card. LINE has no card here, so each one becomes the product's name and a
 * link that opens it inside LINE — a bare slug tells a customer nothing.
 */
function renderForLine(text: string): string {
  return text
    .replace(/\[\[([a-z0-9-]+)\]\]/gi, (_match, slug: string) => {
      const product = getProductBySlug(slug);
      if (!product) return "";
      return `\n🛍️ ${product.name}\n${lineOpenLink(`/product/${slug}`)}\n`;
    })
    // Anything else in double brackets is plumbing for the web panel and must
    // never reach a customer as literal text.
    .replace(/\[\[[\s\S]*?\]\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const HANDOVER_NOTE =
  "\n\nส่งเรื่องให้ทีมงานแล้วนะคะ 📮 ทีมงานจะตอบกลับในแชทนี้ในเวลาทำการ (จ–ศ 9:00–18:00) ค่ะ";

const FALLBACK =
  "ขออภัยค่ะ ตอนนี้น้อง Smoothie ตอบไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ";

/** Files the request for a human and flips the thread to the queue. */
async function escalate(opts: {
  lineUserId: string;
  uid: string | null;
  subject: string;
  customerText: string;
  aiText: string;
  alreadyRecorded: boolean;
}) {
  try {
    const conversation = await openConversation({
      channel: "line",
      channelUserId: opts.lineUserId,
      userId: opts.uid,
      status: "waiting_human",
      subject: opts.subject.slice(0, 120),
    });
    if (!conversation || opts.alreadyRecorded) return;
    // Nothing was filed while the AI was handling this on its own (see
    // caseOpen in api/chat), so the turn that caused the handover has to be
    // written here — otherwise staff open a case with no question in it.
    await appendMessage({ conversationId: conversation.id, senderType: "customer", content: opts.customerText });
    if (opts.aiText.trim()) {
      await appendMessage({ conversationId: conversation.id, senderType: "ai", content: opts.aiText });
    }
  } catch (err) {
    console.error("[line-webhook] escalation failed", err);
  }
}

/** Delivers on the reply token, falling back to a push if it has expired. */
async function deliver(lineUserId: string, replyToken: string | undefined, text: string, quickReplies: string[]) {
  if (replyToken && (await replyLineText(replyToken, text, quickReplies))) return;
  await pushLineText(lineUserId, text);
}

async function handleText(event: LineEvent, lineUserId: string, text: string) {
  // Staff have the conversation: stay silent. The customer's message is still
  // filed so the person handling it sees everything said while they were away.
  if (await isHumanHandling("line", lineUserId)) {
    const uid = await siteUserFor(lineUserId);
    await recordCustomerMessage("line", lineUserId, text, uid);
    return;
  }

  const uid = await siteUserFor(lineUserId);
  const sessionKey = uid || `line:${lineUserId}`;
  // Whether the pipeline will file this turn itself — it does once a case is
  // open, and does not before. Decided before the answer, because the answer
  // is what may open one.
  const alreadyRecorded = await hasOpenCase("line", lineUserId);

  await startLineLoading(lineUserId);

  let raw = "";
  try {
    raw = await askSmoothie({ lineUserId, uid, sessionKey, text });
  } catch (err) {
    console.error("[line-webhook] chat pipeline failed", err);
  }

  const { text: answer, kind, options, reason } = splitMarker(raw);
  let reply = renderForLine(answer) || FALLBACK;

  if (kind === "handoff") {
    await escalate({
      lineUserId,
      uid,
      subject: reason || text,
      customerText: text,
      aiText: reply,
      alreadyRecorded,
    });
    reply += HANDOVER_NOTE;
  }

  // The chips the web panel would draw under the bubble become LINE's own
  // quick-reply bar. A closing offer (CLOSE) and a handover carry no options.
  const quickReplies = kind === "ask" || kind === "suggest" ? options : [];
  await deliver(lineUserId, event.replyToken, reply, quickReplies);
}

const WELCOME =
  "สวัสดีค่ะ 🌿 น้อง Smoothie ผู้ช่วยของ Smooth Life ค่ะ\n\n" +
  "ถามได้เลยนะคะ — แนะนำสินค้าตามปัญหาผิว วิธีใช้ ส่วนผสม โปรโมชัน หรือสถานะออเดอร์\n" +
  "ถ้าอยากคุยกับทีมงานตัวจริง พิมพ์ว่า “ขอคุยกับแอดมิน” ได้เลยค่ะ\n\n" +
  "เมนูด้านล่างเปิดร้านค้า แต้มสะสม และติดตามพัสดุได้ทันทีค่ะ";

async function handleEvent(event: LineEvent) {
  // Only one-to-one chats. The OA can be invited into a group, and a bot
  // answering every message in someone's group chat is not a feature.
  const lineUserId = event.source?.type === "user" ? event.source.userId : undefined;
  if (!lineUserId) return;
  if (alreadyHandled(event.webhookEventId)) return;

  if (event.type === "follow") {
    await deliver(lineUserId, event.replyToken, WELCOME, []);
    return;
  }
  if (event.type !== "message" || !event.message) return;

  if (event.message.type === "text" && event.message.text?.trim()) {
    await handleText(event, lineUserId, event.message.text.trim().slice(0, 2000));
    return;
  }

  // Anything that isn't text still gets an answer — silence reads as broken.
  // Photos are not sent to the model here on purpose: skin analysis asks for
  // consent before a photo is used, and that consent lives in Skin Coach.
  if (await isHumanHandling("line", lineUserId)) return;
  const nudge =
    event.message.type === "image"
      ? `ขอบคุณสำหรับรูปค่ะ 📷 ตอนนี้น้อง Smoothie ดูรูปในไลน์ยังไม่ได้ แต่ถ้าอยากให้วิเคราะห์สภาพผิว กดที่ลิงก์นี้เพื่อสแกนผิวได้เลยค่ะ\n${lineOpenLink("/skin-coach")}\n\nหรือพิมพ์เล่าอาการมาได้เลยนะคะ`
      : "พิมพ์คำถามมาได้เลยค่ะ 💬 เช่น “สิวอุดตันใช้อะไรดี” หรือ “ออเดอร์ถึงไหนแล้ว”";
  await deliver(lineUserId, event.replyToken, nudge, []);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!process.env.LINE_MESSAGING_CHANNEL_SECRET?.trim()) {
    console.error("[line-webhook] LINE_MESSAGING_CHANNEL_SECRET is not set — every event will be rejected");
    return new Response("not configured", { status: 503 });
  }
  if (!verifySignature(raw, req.headers.get("x-line-signature"))) {
    return new Response("bad signature", { status: 403 });
  }

  let events: LineEvent[] = [];
  try {
    events = JSON.parse(raw)?.events ?? [];
  } catch {
    return new Response("bad body", { status: 400 });
  }

  // 200 first, work afterwards. LINE expects the webhook to answer promptly
  // and retries what it considers a failure, while an AI answer takes seconds
  // — so the acknowledgement must not wait for it.
  after(async () => {
    for (const event of events) {
      try {
        await handleEvent(event);
      } catch (err) {
        console.error("[line-webhook] event failed", event.type, err);
      }
    }
  });

  return new Response("ok");
}

/** LINE's "Verify" button in the console sends a GET to check the endpoint. */
export function GET() {
  return new Response("ok");
}
