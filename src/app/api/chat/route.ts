import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import {
  isHumanHandling,
  hasWaitingCase,
  hasOpenCase,
  recordCustomerMessage,
  recordAiMessage,
  type ConversationChannel,
  revertStaleHandover,
} from "@/lib/conversations";
import { getCustomerOrders, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { contentForTranscript } from "@/lib/chat-markers";
import { systemPrompt, orderHistorySummary, type CartLine, type ViewingProduct } from "@/lib/chat-prompt";
import { CHAT_TOOLS, runChatTool } from "@/lib/chat-product-search";
import { KB_TOOL, runKbTool } from "@/lib/chat-kb-tool";
import { MEMBER_TOOL, runMemberTool } from "@/lib/chat-member-tool";
import { logAiAnswer } from "@/lib/kb";
import { otherStoreLinks, otherStoreOrders } from "@/lib/store-links";
import { deliveryStatusForPrompt } from "@/lib/delivery-status";
import { signedAttachmentUrl } from "@/lib/chat-attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Rounds of model ↔ product search per reply; the last one must answer.
const MAX_TOOL_ROUNDS = 4;

type ReviewRow = { author_name: string; rating: number; title: string | null; body: string };
type QuestionRow = { question: string; answer: string | null };

// Real, user-submitted reviews/Q&A for whatever product the customer is
// currently viewing — never fabricated. Returns null if there's nothing to
// show (no reviews yet, DB not configured, or lookup failed).
async function fetchReviewsAndQuestions(slug: string): Promise<{ reviews: ReviewRow[]; questions: QuestionRow[] } | null> {
  if (!supabaseConfigured()) return null;
  try {
    const [reviews, questions] = await Promise.all([
      supabaseRest<ReviewRow[]>(
        `product_reviews?product_slug=eq.${encodeURIComponent(slug)}&select=author_name,rating,title,body&order=created_at.desc&limit=5`
      ),
      supabaseRest<QuestionRow[]>(
        `product_questions?product_slug=eq.${encodeURIComponent(slug)}&select=question,answer&order=created_at.desc&limit=5`
      ),
    ]);
    if (!reviews.length && !questions.length) return null;
    return { reviews, questions };
  } catch (err) {
    console.error("[chat] fetchReviewsAndQuestions failed", err);
    return null;
  }
}

function reviewsSummary(data: { reviews: ReviewRow[]; questions: QuestionRow[] } | null) {
  if (!data) return null;
  const parts: string[] = [];
  if (data.reviews.length) {
    const avg = data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length;
    parts.push(
      `REAL CUSTOMER REVIEWS (avg ${avg.toFixed(1)}/5 from ${data.reviews.length} shown):\n` +
        data.reviews.map((r) => `- ${r.rating}/5${r.title ? ` "${r.title}"` : ""}: ${r.body}`).join("\n")
    );
  }
  if (data.questions.length) {
    parts.push(
      "CUSTOMER Q&A:\n" +
        data.questions
          .map((q) => `- Q: ${q.question}\n  A: ${q.answer ? q.answer : "(not yet answered by staff — don't invent an answer on their behalf)"}`)
          .join("\n")
    );
  }
  return parts.join("\n\n");
}

function textStream(text: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function textResponse(text: string, status = 200) {
  return new Response(textStream(text), {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function requestIdentity(req: NextRequest, anonId: string | undefined) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return { uid, sessionKey: uid || anonId || ip };
}

// Lightweight rolling-window rate limit backed by chat_messages itself (no
// extra table needed) — mainly a cost guard on the Anthropic API, not a
// security boundary. Fails open (allows the request) if the DB is
// unreachable, since a chat outage shouldn't be caused by the limiter.
const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX = 20;

async function isRateLimited(sessionKey: string): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  try {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000).toISOString();
    const rows = await supabaseRest<{ id: string }[]>(
      `chat_messages?session_key=eq.${encodeURIComponent(sessionKey)}&role=eq.user&created_at=gte.${since}&select=id`
    );
    return rows.length >= RATE_LIMIT_MAX;
  } catch (err) {
    console.error("[chat] rate limit check failed", err);
    return false;
  }
}

async function persistMessage(opts: {
  uid: string | null;
  sessionKey: string;
  role: "user" | "assistant";
  content: string;
  viewingSlug?: string;
}) {
  if (!supabaseConfigured() || !opts.content.trim()) return;
  try {
    await supabaseRest("chat_messages", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: opts.uid,
        session_key: opts.sessionKey,
        role: opts.role,
        content: opts.content,
        viewing_product_slug: opts.viewingSlug || null,
      }),
    });
  } catch (err) {
    console.error("[chat] persistMessage failed", err);
  }
}

// Recent conversation history for this identity, so reopening the chat (or
// coming back later) doesn't lose context. Text only — photos are never
// persisted (matches the "we don't store your photo" consent copy).
export async function GET(req: NextRequest) {
  const anonId = req.nextUrl.searchParams.get("anonId") || undefined;
  const { sessionKey, uid } = requestIdentity(req, anonId);
  if (!supabaseConfigured()) return Response.json({ messages: [] });
  try {
    // Before reporting who is answering, give a queued case that nobody
    // picked up its way back to the AI — the panel polls this, so the
    // handover times out on its own without a cron the Hobby plan cannot run.
    if (uid) await revertStaleHandover("web", uid);
    const [rows, handling] = await Promise.all([
      // Newest 40, not oldest. This asked for the first 40 ever written, so
      // once a thread passed forty messages the panel was serving a
      // conversation from days ago and nothing new could ever appear in it.
      supabaseRest<
        { role: "user" | "assistant"; content: string; from_staff: boolean; created_at: string; attachment_path: string | null }[]
      >(
        `chat_messages?session_key=eq.${encodeURIComponent(sessionKey)}&select=role,content,from_staff,created_at,attachment_path&order=created_at.desc&limit=40`
      ),
      // Whether a person has taken this conversation over. The customer's
      // panel needs it for two things: to stop pretending the AI is answering,
      // and to offer them a way back to it.
      uid ? isHumanHandling("web", uid) : Promise.resolve(false),
    ]);
    // Queued counts as well as picked-up: after a reload the panel forgets it
    // has already handed over, and without this the next handover marker files
    // a second ticket for a case nobody has answered yet.
    const queued = uid ? await hasWaitingCase("web", uid) : false;
    // Back into reading order, and with the newest timestamp alongside: the
    // panel decides whether to adopt this copy by whether time has moved, not
    // by whether the list got longer — which stopped being true at the cap.
    // Signed on every read: the bucket is private and a link goes stale in
    // minutes, so a photo staff attached stays viewable without ever becoming
    // a permanent public address for it.
    const ordered = [...rows].reverse();
    const messages = await Promise.all(
      ordered.map(async (m) => ({
        ...m,
        attachmentUrl: m.attachment_path ? await signedAttachmentUrl(m.attachment_path) : null,
      }))
    );
    return Response.json({
      messages,
      latestAt: messages[messages.length - 1]?.created_at ?? null,
      humanHandling: handling,
      caseQueued: queued,
    });
  } catch (err) {
    console.error("[chat] history fetch failed", err);
    return Response.json({ messages: [] });
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return textResponse("invalid body", 400);
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const profile = body?.profile;
  const lang = body?.lang === "en" ? "en" : "th";
  const cart = Array.isArray(body?.cart) ? body.cart : [];
  const anonId = typeof body?.anonId === "string" ? body.anonId : undefined;
  const rawViewing = body?.viewingProduct;
  const viewingProduct: ViewingProduct | undefined =
    rawViewing && typeof rawViewing.slug === "string" && typeof rawViewing.name === "string"
      ? {
          slug: rawViewing.slug,
          name: rawViewing.name,
          brand: typeof rawViewing.brand === "string" ? rawViewing.brand : "",
          price: typeof rawViewing.price === "number" ? rawViewing.price : 0,
          compareAtPrice: typeof rawViewing.compareAtPrice === "number" ? rawViewing.compareAtPrice : undefined,
          category: typeof rawViewing.category === "string" ? rawViewing.category : "",
          concerns: Array.isArray(rawViewing.concerns) ? rawViewing.concerns : [],
          benefits: Array.isArray(rawViewing.benefits) ? rawViewing.benefits : [],
          howToUse: typeof rawViewing.howToUse === "string" ? rawViewing.howToUse : "",
          ingredients: typeof rawViewing.ingredients === "string" ? rawViewing.ingredients : "",
          whoFor: typeof rawViewing.whoFor === "string" ? rawViewing.whoFor : "",
          sizes: Array.isArray(rawViewing.sizes) ? rawViewing.sizes : [],
        }
      : undefined;
  const key = process.env.ANTHROPIC_API_KEY;

  const { uid, sessionKey } = requestIdentity(req, anonId);

  // Which inbox thread this turn belongs to. The web panel is no longer the
  // only way in — the LINE webhook hands this same pipeline a conversation on
  // the `line` channel, identified by the customer's LINE userId — so the
  // channel is read off the request instead of being assumed to be "web, the
  // signed-in customer". Unchanged for the panel, which sends neither field.
  const channel: ConversationChannel = body?.channel === "line" ? "line" : "web";
  const channelUserId =
    channel === "line" && typeof body?.channelUserId === "string" && body.channelUserId
      ? (body.channelUserId as string)
      : uid;

  const image = body?.image;
  const imageBase64 = typeof image?.base64 === "string" ? image.base64 : "";
  const imageMediaType = image?.mediaType === "image/png" ? "image/png" : "image/jpeg";
  // Rough cap so someone can't post an enormous payload to this route.
  if (imageBase64 && imageBase64.length > 6_000_000) {
    return textResponse(lang === "en" ? "That photo is too large. Please try a smaller one." : "รูปนี้ใหญ่เกินไปค่ะ กรุณาลองรูปที่เล็กลง", 413);
  }

  if (!key) {
    return textResponse(
      lang === "en"
        ? "Smoothie isn't connected yet. Add an ANTHROPIC_API_KEY environment variable in your Vercel project settings and redeploy to enable live chat. In the meantime, the personalised product picks above are based on your quiz answers."
        : "ยังไม่ได้เชื่อมต่อน้อง Smoothie ค่ะ — กรุณาเพิ่มค่า ANTHROPIC_API_KEY ใน Environment Variables ของโปรเจกต์บน Vercel แล้ว deploy ใหม่ เพื่อเปิดใช้งานแชทสด ระหว่างนี้สินค้าที่แนะนำด้านบนคัดมาจากคำตอบในแบบประเมินของคุณแล้วค่ะ"
    );
  }

  // Once staff have taken the conversation over in the unified inbox, the AI
  // must stop answering — two replies to one question, disagreeing with each
  // other, is worse than a short wait. The customer's message is still
  // recorded so it shows up in the inbox for the person now handling it.
  const lastUserMessage = [...messages].reverse().find((m: { role?: string }) => m?.role === "user");

  // A case that is merely queued does not silence the AI — see
  // isHumanHandling in lib/conversations. The message is still filed so the
  // person who eventually opens the case sees everything that was said while
  // it sat in the queue.
  if (channelUserId) await revertStaleHandover(channel, channelUserId);
  const caseWaiting = channelUserId ? await hasWaitingCase(channel, channelUserId) : false;
  const humanHandling = channelUserId ? await isHumanHandling(channel, channelUserId) : false;
  // Anything said while a case is open belongs in the inbox, even the turns
  // the AI is handling. Recording only during waiting/assigned left a hole:
  // the question asked before the customer went back to the bot, then the
  // staff reply after, and nothing between — so staff read an answer to a
  // question that was not on the page.
  const caseOpen =
    caseWaiting || humanHandling || (channelUserId ? await hasOpenCase(channel, channelUserId) : false);

  // Only the humanHandling branch below returns before the AI path, and with
  // it the persistMessage further down — so only it has to write the
  // customer's message to chat_messages itself. That is the table their panel
  // replays on reload, and staff replies are already mirrored into it, so a
  // customer coming back to a handed-over conversation would otherwise see
  // only our half of it.
  //
  // Gated on humanHandling and not caseOpen: with a case merely open the AI
  // still answers, so the path below persists the same message a second or
  // two later and the customer's panel showed everything they said twice.
  if (humanHandling && typeof lastUserMessage?.content === "string") {
    const content = imageBase64 ? `[[PHOTO]] ${lastUserMessage.content}` : lastUserMessage.content;
    await persistMessage({ uid, sessionKey, role: "user", content, viewingSlug: viewingProduct?.slug });
  }

  if (caseOpen && !humanHandling && channelUserId && typeof lastUserMessage?.content === "string") {
    await recordCustomerMessage(channel, channelUserId, lastUserMessage.content, uid);
  }

  if (humanHandling) {
    if (channelUserId && typeof lastUserMessage?.content === "string") {
      await recordCustomerMessage(channel, channelUserId, lastUserMessage.content, uid);
    }
    return textResponse(
      lang === "en"
        ? "A member of our team is looking at your message and will reply here shortly."
        : "ทีมงานกำลังดูข้อความของคุณอยู่ และจะตอบกลับที่นี่เร็ว ๆ นี้ค่ะ"
    );
  }

  if (await isRateLimited(sessionKey)) {
    return textResponse(
      lang === "en"
        ? "You've sent quite a few messages in a short time — please wait a few minutes before asking again."
        : "คุณส่งข้อความถี่มากในช่วงเวลานี้ค่ะ กรุณารอสักครู่แล้วลองถามใหม่อีกครั้งนะคะ"
    );
  }

  // Real order history — only when logged in AND linked to a Shopify
  // customer record. Best-effort: any failure just falls back to "not
  // available" rather than breaking the reply.
  let orderHistory: string | null = null;
  let deliveryStatus: string | null = null;
  let hasShopifyLink = false;
  if (uid && supabaseConfigured() && shopifyAdminConfigured()) {
    try {
      const [row] = await supabaseRest<{ shopify_customer_id: string | null }[]>(
        `users?id=eq.${uid}&select=shopify_customer_id`
      );
      // Orders placed on smooth-e.com or dentiste-oralcare.com too, labelled
      // with their store, for accounts linked there.
      const links = await otherStoreLinks(uid);
      const others = links.length ? await otherStoreOrders(links, 5) : [];
      if (row?.shopify_customer_id || links.length > 0) {
        hasShopifyLink = true;
        const orders = row?.shopify_customer_id ? await getCustomerOrders(row.shopify_customer_id) : [];
        const all = [...(orders ?? []), ...others.flatMap((o) => o.orders)].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        orderHistory = orderHistorySummary(all);
        // Dates and thresholds worked out in code — see delivery-status.ts.
        // The model is given conclusions to repeat, not raw timestamps to
        // reason about, because "9 days ago" is not a judgement call. Smooth
        // Life's shipping timings only, so only its orders.
        deliveryStatus = deliveryStatusForPrompt(orders);
      }
    } catch (err) {
      console.error("[chat] order history lookup failed", err);
    }
  }

  const reviewsQaData = viewingProduct ? await fetchReviewsAndQuestions(viewingProduct.slug) : null;
  const reviewsQa = reviewsSummary(reviewsQaData);

  const trimmed = messages
    .filter((m: any) => m && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content as string,
    }));

  // Persist the latest user turn (fire-and-forget-ish — awaited but never
  // throws, see persistMessage). Only the newest message, since earlier
  // turns in this request were already persisted on their own request.
  // The photo itself is never saved (see the consent copy — "temporary
  // analysis only") but a "[[PHOTO]]" prefix marks that one was attached,
  // so reopening the chat later still shows a placeholder instead of the
  // text just looking like a random orphaned question.
  const lastUserMsg = trimmed[trimmed.length - 1];
  if (lastUserMsg?.role === "user") {
    const content = imageBase64 ? `[[PHOTO]] ${lastUserMsg.content}` : lastUserMsg.content;
    await persistMessage({ uid, sessionKey, role: "user", content, viewingSlug: viewingProduct?.slug });
  }

  // Attach the photo (if any) to the most recent user turn only — earlier
  // turns never carry an image, so the payload doesn't balloon on longer chats.
  let anthropicMessages: any[] = trimmed;
  if (imageBase64) {
    const lastIdx = [...trimmed].map((m) => m.role).lastIndexOf("user");
    if (lastIdx !== -1) {
      anthropicMessages = trimmed.map((m, i) =>
        i === lastIdx
          ? {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: imageMediaType, data: imageBase64 } },
                { type: "text", text: m.content },
              ],
            }
          : m
      );
    }
  }

  const client = new Anthropic({ apiKey: key });
  const encoder = new TextEncoder();
  const system = systemPrompt(
    profile,
    lang,
    cart,
    viewingProduct,
    reviewsQa,
    orderHistory,
    deliveryStatus,
    hasShopifyLink,
    caseWaiting,
    Boolean(uid)
  );

  // What the customer just asked, for the AI answer log.
  const lastUserText = [...messages]
    .reverse()
    .find((m: { role?: string; content?: unknown }) => m?.role === "user" && typeof m?.content === "string")?.content as string | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      // Which approved articles this answer leant on, for the AI log: an
      // answer about a policy has to be traceable to the article it came from.
      const kbMatches: string[] = [];
      let kbAsked = false;
      try {
        // Product lookups happen through tools: the model searches, we run
        // the search here and hand back the results, and it continues. Text
        // streams to the customer as it arrives in every round. The last
        // allowed round turns tools off so a reply always comes back.
        let convo: Anthropic.MessageParam[] = anthropicMessages;
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const lastRound = round === MAX_TOOL_ROUNDS - 1;
          const anthropicStream = client.messages.stream({
            model: MODEL,
            max_tokens: 1600,
            // Short product-advice replies don't need deep reasoning — low
            // effort is the documented setting for latency-sensitive chat,
            // and cuts the adaptive-thinking time Sonnet 5 spends by default.
            output_config: { effort: "low" },
            system,
            tools: [...CHAT_TOOLS, KB_TOOL, MEMBER_TOOL],
            ...(lastRound ? { tool_choice: { type: "none" as const } } : {}),
            messages: convo,
          });
          let roundStarted = false;
          anthropicStream.on("text", (delta) => {
            // Keep a round's text apart from what an earlier round already said.
            if (!roundStarted && fullText && !/\s$/.test(fullText)) {
              fullText += "\n\n";
              controller.enqueue(encoder.encode("\n\n"));
            }
            roundStarted = true;
            fullText += delta;
            controller.enqueue(encoder.encode(delta));
          });
          const final = await anthropicStream.finalMessage();
          if (final.stop_reason !== "tool_use") break;
          // The knowledge base is a database read, so this round waits; the
          // catalogue tools answer from memory.
          const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
            final.content
              .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
              .map(async (b) => {
                // The account lookup takes its customer from the session
                // cookie, never from the model's arguments — see the security
                // note in @/lib/chat-member-tool.
                if (b.name === MEMBER_TOOL.name) {
                  return { type: "tool_result" as const, tool_use_id: b.id, content: await runMemberTool(uid) };
                }
                if (b.name !== KB_TOOL.name) {
                  return { type: "tool_result" as const, tool_use_id: b.id, content: runChatTool(b.name, b.input) };
                }
                const result = await runKbTool(b.input);
                kbMatches.push(...result.matches.map((m) => m.article_id));
                kbAsked = true;
                return { type: "tool_result" as const, tool_use_id: b.id, content: result.text };
              })
          );
          convo = [...convo, { role: "assistant", content: final.content }, { role: "user", content: results }];
        }
        controller.close();
        // Drop a trailing [[SUGGEST: ...]] — those chips are optional
        // follow-ups, worth nothing once the turn is over, and not worth
        // keeping in the transcript.
        //
        // [[ASK: ...]] stays. It carries the answer options for a question
        // the customer has not answered yet, and reopening the panel has to
        // put those buttons back — strip it here and history comes back as a
        // question with no way to tap an answer. Every render path runs it
        // through splitMarker instead, so the brackets themselves are never
        // shown (see hydrateHistory in QuickChat and the inbox transcript).
        const toSave = contentForTranscript(fullText);
        // Same reason as the customer's side above — a thread with only half
        // the exchange in it is worse than no thread.
        if (caseOpen && channelUserId && toSave.trim()) {
          await recordAiMessage(channel, channelUserId, toSave);
        }
        await persistMessage({ uid, sessionKey, role: "assistant", content: toSave, viewingSlug: viewingProduct?.slug });
        if (kbAsked && lastUserText) {
          await logAiAnswer({ uid, question: lastUserText, answer: toSave, articleIds: kbMatches, escalated: kbMatches.length === 0 });
        }
      } catch (err) {
        console.error("[anthropic] stream error model=" + MODEL, err);
        const msg =
          lang === "en"
            ? "\n\nSorry, I couldn't reach the AI service just now. Please try again."
            : "\n\nขออภัยค่ะ ตอนนี้เชื่อมต่อบริการ AI ไม่ได้ กรุณาลองใหม่อีกครั้ง";
        controller.enqueue(encoder.encode(msg));
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
