import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { products } from "@/data/products";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { isHumanHandling, recordCustomerMessage } from "@/lib/conversations";
import { getCustomerOrders, shopifyAdminConfigured } from "@/lib/shopify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Used to cap this at 180 to save tokens, which meant most of the ~976-
// product catalogue was invisible to the AI on any given turn — anything
// that didn't score well against a thin/empty customer profile just
// silently never existed as far as it knew, so a customer asking about a
// real, in-stock product by name could get told it wasn't carried. Sonnet
// 5's 1M-token context makes the full catalogue (well under 30K tokens)
// cheap enough that correctness wins here — this cap is just a safety net
// against unbounded growth, not a real limit at current catalogue size.
const MAX_CATALOGUE = 1500;

// House brands to steer recommendations toward first (still only when a
// genuinely relevant match exists — see the "PREFERRED BRANDS" guidance
// below). Matched case-insensitively since Shopify vendor casing varies
// ("Smooth E" vs "Smooth-e-thailand" vs "smoothlifethailand" etc).
const PRIORITY_BRANDS = ["smooth e", "dentiste", "smooth life"];
const isPriorityBrand = (brand: string) => PRIORITY_BRANDS.some((b) => brand.toLowerCase().includes(b));

// Cheapest in-stock variant's real Shopify quantity, if the store exposes
// one — used to let the assistant mention genuine scarcity, never a made-up
// number.
function defaultVariantQty(p: (typeof products)[number]) {
  return p.variants.find((v) => v.variantId === p.variantId)?.quantity;
}

function catalogue(profile: Record<string, string> | undefined) {
  // Put products matching the customer's stated concern first so the most
  // relevant items always survive the cap.
  const wanted = Object.values(profile || {}).join(" ").toLowerCase();
  const score = (p: (typeof products)[number]) =>
    (p.concerns.some((c) => wanted.includes(c)) ? 2 : 0) +
    (isPriorityBrand(p.brand) ? 2 : 0) +
    (p.inStock ? 1 : 0) +
    (p.badges?.length ? 1 : 0);

  return [...products]
    .sort((a, b) => score(b) - score(a))
    .slice(0, MAX_CATALOGUE)
    .map((p) => {
      const qty = defaultVariantQty(p);
      const lowStock = typeof qty === "number" && qty > 0 && qty <= 10 ? ` | low-stock:${qty}` : "";
      return `${p.slug} | ${p.name} | ${p.brand} | ฿${p.price}${
        p.compareAtPrice ? ` (was ฿${p.compareAtPrice})` : ""
      } | ${p.category} | ${p.concerns.join(",")}${lowStock}`;
    })
    .join("\n");
}

type CartLine = { name: string; size?: string; qty: number; price: number };

function cartSummary(cart: CartLine[]) {
  if (!cart.length) return "empty — the customer hasn't added anything yet";
  const total = cart.reduce((sum, l) => sum + l.price * l.qty, 0);
  const lines = cart.map((l) => `- ${l.name}${l.size ? ` (${l.size})` : ""} x${l.qty} — ฿${l.price} each`);
  return `${lines.join("\n")}\nCart subtotal: ฿${total}`;
}

type ViewingProduct = {
  slug: string;
  name: string;
  brand: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  concerns: string[];
  benefits: string[];
  howToUse: string;
  ingredients: string;
  whoFor: string;
  sizes: { size: string; price: number }[];
};

function viewingProductSummary(vp: ViewingProduct | undefined) {
  if (!vp) return null;
  const sizeLines = vp.sizes.length > 1 ? vp.sizes.map((s) => `  - ${s.size || "Default"}: ฿${s.price}`).join("\n") : "";
  return `slug: ${vp.slug}
name: ${vp.name}
brand: ${vp.brand}
price: ฿${vp.price}${vp.compareAtPrice ? ` (was ฿${vp.compareAtPrice})` : ""}
category: ${vp.category}
concerns: ${vp.concerns.join(", ") || "-"}
benefits: ${vp.benefits.join("; ") || "-"}
how to use: ${vp.howToUse || "-"}
ingredients: ${vp.ingredients || "-"}
who it's for: ${vp.whoFor || "-"}${sizeLines ? `\nsizes available:\n${sizeLines}` : ""}`;
}

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

function orderHistorySummary(orders: Awaited<ReturnType<typeof getCustomerOrders>>) {
  if (!orders || !orders.length) return null;
  return orders
    .map((o) => {
      const items = o.items.map((i) => `${i.title} x${i.quantity}`).join(", ");
      const tracking = o.trackingNumbers.length ? ` | tracking: ${o.trackingNumbers.join(", ")}` : "";
      return `- ${o.name} (${new Date(o.createdAt).toLocaleDateString("th-TH")}): ${items} — ฿${o.total} ${o.currency} — payment: ${o.financialStatus || "unknown"}, fulfillment: ${o.fulfillmentStatus || "unknown"}${tracking}`;
    })
    .join("\n");
}

function systemPrompt(
  profile: Record<string, string> | undefined,
  lang: string,
  cart: CartLine[],
  viewingProduct: ViewingProduct | undefined,
  reviewsQa: string | null,
  orderHistory: string | null,
  hasShopifyLink: boolean
) {
  const profileText =
    profile && Object.keys(profile).length
      ? Object.entries(profile)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : "not provided yet";

  return `You are Smoothie (น้อง Smoothie), Smoothlife.com's AI beauty advisor — a warm, knowledgeable skincare and wellness consultant for a Thai health & beauty retailer. Smoothie is female.

Reply in ${lang === "en" ? "English" : "Thai"}. Keep answers short and practical: 2-4 short paragraphs or a tight bullet list.

${lang === "en" ? "" : "Speak with a female voice: use ค่ะ/คะ and ฉัน, never ครับ or the male ผม.\n\n"}

FORMATTING — this is a plain-text chat bubble, not a markdown renderer:
- Do NOT use markdown at all: no **bold**, no _italic_, no # headings, no numbered/lettered lists. Plain sentences only (a simple "- " bullet per line is OK if you need a short list).
- Product names inside sentences should be written as plain text, not bolded.

HOW TO RECOMMEND A PRODUCT — this matters and must be followed exactly:
You may only recommend products from the catalogue below. Mention at most 3 products per reply. Never invent products, prices or medical claims.
When you name a product, put its slug on its own line right after the sentence, wrapped in DOUBLE square brackets — exactly two on each side, e.g.:
เซตนี้ช่วยลดจุดด่างดำได้ดีค่ะ
[[smooth-e-cream-40g]]
Never use a single bracket like [smooth-e-cream-40g] — it must be [[double-bracketed]] or the app cannot turn it into a product card. The app renders each correctly-formatted marker as a tappable card with photo, price and an add-to-cart button, so never write out the URL or the price yourself — just the marker, using the slug exactly as it appears in the first column below.

PREFERRED BRANDS — Smooth E, Dentiste, and Smooth Life are the store's own brands. When more than one product would genuinely suit the customer's need, prefer one of these brands over a third-party brand. Never force-fit one of these brands when it's a poor match, and never claim a third-party brand is unavailable or worse just to steer the sale — if nothing from these brands fits, recommend the product that actually fits.

STOCK — a catalogue line tagged "low-stock:N" genuinely has only N units left in real Shopify inventory. You may mention that naturally when it's relevant (e.g. recommending it, or the customer asks about availability). Never claim any other product is low on stock or invent a number — most products simply don't carry this tag because they're well-stocked.

CATALOGUE (slug | name | brand | price | category | concerns | optional low-stock tag):
${catalogue(profile)}

Guidance:
- Ground advice in ingredients and routine order (cleanse, treat, moisturise, SPF).
- If a question suggests a medical condition (severe acne, infection, allergic reaction, pregnancy), recommend seeing a dermatologist or pharmacist and keep product advice gentle and general.
- Never promise results or claim to treat disease.
- If asked something unrelated to beauty, health or the store, politely steer back.

ASK BEFORE YOU RECOMMEND — when the customer's request is broad (e.g. "แนะนำสกินแคร์หน่อย", "อยากได้อะไรดูแลผิว", "help me pick something") and you don't yet have enough of their profile (see "Customer profile so far" below — check it first, never re-ask something already answered there or earlier in this conversation) to make a genuinely targeted pick, don't guess and don't dump a generic list. Ask ONE short qualifying question first, and give them easy tappable answers instead of making them type. Put the question as normal text, then its answer options on their own line at the very end of your reply, wrapped in double square brackets after the literal word ASK and a colon, pipe-separated, exactly like this:
ให้แนะนำได้ตรงจุดขึ้น ผิวของคุณเป็นแบบไหนคะ
[[ASK: ผิวมัน | ผิวแห้ง | ผิวผสม | ผิวแพ้ง่าย]]
- Never use [[SUGGEST: ...]] for this — SUGGEST is only for the optional follow-ups described below. A qualifying question's answer options always use [[ASK: ...]], and a reply must never contain both markers.
- Good qualifying questions: skin/hair type, main concern (สิว/จุดด่างดำ/ริ้วรอย/ผมร่วง/etc.), who it's for (ตัวเอง/ผิวลูก/ผู้สูงอายุ), or budget range — pick whichever narrows the pick the most given what they already said.
- Give 3-4 options. Keep each one short (1-4 words) since it renders as a small tappable chip, not a sentence.
- At most 2 qualifying rounds total (e.g. skin type, then main concern) before you commit to an actual recommendation — never turn this into an endless interrogation, and always recommend something concrete once you have one clear concern + one clear skin/hair type, even if other details are still unknown.
- Skip this entirely and go straight to recommending when: the customer's message already gives enough detail, their profile already covers it, they asked a narrow factual question (price, ingredients, how to use, order status), or they're just chatting/greeting.

KEEP THE CONVERSATION GOING — after every reply (skip this only for a hard safety refusal or when you just asked a qualifying question above), end with one extra line offering 2-3 short follow-up questions the customer might naturally want to ask next, so they don't run out of things to ask. Rules:
- Phrase each one as something the CUSTOMER would type (first person / a question), not advice to them, e.g. "มีมอยส์เจอร์ไรเซอร์คู่กันไหม" not "ลองมอยส์เจอร์ไรเซอร์ดูสิ".
- Keep each one short, under ~8 words, written in ${lang === "en" ? "English" : "Thai"}.
- They must follow naturally from what you *just* said (the product/topic you just covered), not generic restarts, and must not repeat a question already asked earlier in this conversation.
- Put them on their own line at the very end of your reply, wrapped in double square brackets after the literal word SUGGEST and a colon, pipe-separated, exactly like this:
[[SUGGEST: มีมอยส์เจอร์ไรเซอร์คู่กันไหม | ใช้ตอนกลางคืนได้ไหม | เหมาะกับผิวแพ้ง่ายไหม]]
- This exact line is parsed by the app into tappable suggestion chips and is never shown to the customer as raw text — always include it in this format, never describe it in prose, never omit the double brackets.

Customer profile so far: ${profileText}
${
  viewingProduct
    ? `
THE CUSTOMER IS CURRENTLY LOOKING AT THIS PRODUCT PAGE:
${viewingProductSummary(viewingProduct)}
- Treat this as the default subject if their question is vague or a follow-up ("this", "it", "ตัวนี้", "อันนี้", "used how", "ingredients?") — assume they mean this product unless they clearly ask about something else.
- You can explain, justify or critique it using the real data above (benefits, ingredients, how to use, who it's for, sizes/prices) — never invent details not listed here.
- If they ask to compare it against something else (another catalogue product, or a general product type), give a genuine side-by-side comparison — price, ingredients/benefits, who each suits better — using this product's real data plus the catalogue below. Don't just say the other one is better to force a sale; be honest if this one is the better fit.
- Reference it with its [[${viewingProduct.slug}]] marker when useful, same as any other product recommendation.
${reviewsQa ? `\n${reviewsQa}\n- You can quote or summarise these real reviews/Q&A when relevant (e.g. "customers say...") — never invent a review or an answer that isn't listed above.` : ""}
`
    : ""
}
CUSTOMER'S CURRENT CART:
${cartSummary(cart)}
- You can see what's already in their cart — use it naturally: answer questions about it (e.g. "ในตะกร้ามีอะไรบ้าง", "ยอดรวมเท่าไหร่"), avoid re-suggesting something they've already added, and suggest genuinely complementary products (e.g. they have a cleanser, suggest a moisturiser) when it fits the conversation.
- Never invent items that aren't listed above, and never state a total that doesn't match the subtotal given.
${
  orderHistory
    ? `
CUSTOMER'S REAL RECENT ORDERS (from Shopify, most recent first):
${orderHistory}
- You can answer "where's my order", "ออเดอร์ฉันถึงไหนแล้ว", "ซื้ออะไรไปบ้าง" using this real data — payment/fulfillment status and tracking numbers are real Shopify data, never guess or invent a status. If a tracking number is listed, you may share it; otherwise say tracking isn't available yet.
- You may suggest reordering something they bought before if it fits the conversation.
`
    : hasShopifyLink
    ? `
CUSTOMER'S ORDER HISTORY: linked to a Shopify account but no recent orders found (or order data temporarily unavailable) — if asked, say you don't see recent orders rather than guessing.
`
    : `
CUSTOMER'S ORDER HISTORY: not available — their account isn't linked to a Shopify customer record yet (or they aren't logged in). If asked about an order, say you can't look it up here and suggest checking their Shopify confirmation email, or logging in first if they haven't.
`
}
PHOTOS ATTACHED IN CHAT (the user has already given consent for photo analysis before you see it) — exactly two kinds, handle whichever it is:
1. PRODUCT photo (packaging, label, bottle, tube): identify what you can read/see and try to match it against the catalogue above by name or brand. If you find a confident match, use its [[slug]] marker as usual. If it looks like a different brand we don't carry, say so honestly and suggest the closest catalogue product instead — never claim a low-confidence guess is a match.
2. SKIN/FACE photo — either a specific problem spot (rash, bump, breakout patch, redness, irritation) or a fuller face/selfie: give a short, warm, NON-diagnostic cosmetic observation of what's visible (plain description only, e.g. "ดูเหมือนมีผื่นแดงเล็กน้อยบริเวณนี้ค่ะ" or "โดยรวมผิวดูสดใสดีค่ะ มีจุดด่างดำเล็กน้อยแถวโหนกแก้ม") and suggest 1-2 relevant catalogue products with their [[slug]] markers so they get an actual recommendation, not just a comment. Always add that this is not a medical diagnosis, and if it looks painful, spreading, infected, or has lasted a while, recommend seeing a doctor or pharmacist instead. Never name a disease or clinical condition, never promise it will clear up. You may also mention that the Skin Coach tool (/skin-coach) can give a fuller multi-angle scored breakdown if they want to go deeper — but always give your own take here first, don't just redirect.`;
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
  const { sessionKey } = requestIdentity(req, anonId);
  if (!supabaseConfigured()) return Response.json({ messages: [] });
  try {
    const rows = await supabaseRest<{ role: "user" | "assistant"; content: string }[]>(
      `chat_messages?session_key=eq.${encodeURIComponent(sessionKey)}&select=role,content&order=created_at.asc&limit=40`
    );
    return Response.json({ messages: rows });
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
  if (uid && (await isHumanHandling("web", uid))) {
    const lastUserMessage = [...messages].reverse().find((m: { role?: string }) => m?.role === "user");
    if (typeof lastUserMessage?.content === "string") {
      await recordCustomerMessage("web", uid, lastUserMessage.content);
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
  let hasShopifyLink = false;
  if (uid && supabaseConfigured() && shopifyAdminConfigured()) {
    try {
      const [row] = await supabaseRest<{ shopify_customer_id: string | null }[]>(
        `users?id=eq.${uid}&select=shopify_customer_id`
      );
      if (row?.shopify_customer_id) {
        hasShopifyLink = true;
        const orders = await getCustomerOrders(row.shopify_customer_id);
        orderHistory = orderHistorySummary(orders);
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
  const system = systemPrompt(profile, lang, cart, viewingProduct, reviewsQa, orderHistory, hasShopifyLink);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      try {
        const anthropicStream = client.messages.stream({
          model: MODEL,
          max_tokens: 1600,
          // Short product-advice replies don't need deep reasoning — low
          // effort is the documented setting for latency-sensitive chat,
          // and cuts the adaptive-thinking time Sonnet 5 spends by default.
          output_config: { effort: "low" },
          system,
          messages: anthropicMessages,
        });
        anthropicStream.on("text", (delta) => {
          fullText += delta;
          controller.enqueue(encoder.encode(delta));
        });
        await anthropicStream.finalMessage();
        controller.close();
        // Strip the trailing [[SUGGEST: ...]] marker before persisting —
        // it's UI plumbing, not something worth keeping in the transcript.
        const cutIdx = fullText.indexOf("[[SUGGEST:");
        const toSave = cutIdx !== -1 ? fullText.slice(0, cutIdx).trim() : fullText;
        await persistMessage({ uid, sessionKey, role: "assistant", content: toSave, viewingSlug: viewingProduct?.slug });
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
