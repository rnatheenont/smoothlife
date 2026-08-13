import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { products } from "@/data/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const MAX_CATALOGUE = 180;

// House brands to steer recommendations toward first (still only when a
// genuinely relevant match exists — see the "PREFERRED BRANDS" guidance
// below). Matched case-insensitively since Shopify vendor casing varies
// ("Smooth E" vs "Smooth-e-thailand" vs "smoothlifethailand" etc).
const PRIORITY_BRANDS = ["smooth e", "dentiste", "smooth life"];
const isPriorityBrand = (brand: string) => PRIORITY_BRANDS.some((b) => brand.toLowerCase().includes(b));

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
    .map(
      (p) =>
        `${p.slug} | ${p.name} | ${p.brand} | ฿${p.price}${
          p.compareAtPrice ? ` (was ฿${p.compareAtPrice})` : ""
        } | ${p.category} | ${p.concerns.join(",")}`
    )
    .join("\n");
}

type CartLine = { name: string; size?: string; qty: number; price: number };

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

function cartSummary(cart: CartLine[]) {
  if (!cart.length) return "empty — the customer hasn't added anything yet";
  const total = cart.reduce((sum, l) => sum + l.price * l.qty, 0);
  const lines = cart.map((l) => `- ${l.name}${l.size ? ` (${l.size})` : ""} x${l.qty} — ฿${l.price} each`);
  return `${lines.join("\n")}\nCart subtotal: ฿${total}`;
}

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

function systemPrompt(
  profile: Record<string, string> | undefined,
  lang: string,
  cart: CartLine[],
  viewingProduct: ViewingProduct | undefined
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

CATALOGUE (slug | name | brand | price | category | concerns):
${catalogue(profile)}

Guidance:
- Ground advice in ingredients and routine order (cleanse, treat, moisturise, SPF).
- If a question suggests a medical condition (severe acne, infection, allergic reaction, pregnancy), recommend seeing a dermatologist or pharmacist and keep product advice gentle and general.
- Never promise results or claim to treat disease.
- If asked something unrelated to beauty, health or the store, politely steer back.

KEEP THE CONVERSATION GOING — after every reply (skip this only for a hard safety refusal), end with one extra line offering 2-3 short follow-up questions the customer might naturally want to ask next, so they don't run out of things to ask. Rules:
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
`
    : ""
}
CUSTOMER'S CURRENT CART:
${cartSummary(cart)}
- You can see what's already in their cart — use it naturally: answer questions about it (e.g. "ในตะกร้ามีอะไรบ้าง", "ยอดรวมเท่าไหร่"), avoid re-suggesting something they've already added, and suggest genuinely complementary products (e.g. they have a cleanser, suggest a moisturiser) when it fits the conversation.
- Never invent items that aren't listed above, and never state a total that doesn't match the subtotal given.

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

  const trimmed = messages
    .filter((m: any) => m && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content as string,
    }));

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
  const system = systemPrompt(profile, lang, cart, viewingProduct);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
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
          controller.enqueue(encoder.encode(delta));
        });
        await anthropicStream.finalMessage();
        controller.close();
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
