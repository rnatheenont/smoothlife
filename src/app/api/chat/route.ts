import { NextRequest, NextResponse } from "next/server";
import { products } from "@/data/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

const MAX_CATALOGUE = 180;

function catalogue(profile: Record<string, string> | undefined) {
  // Put products matching the customer's stated concern first so the most
  // relevant items always survive the cap.
  const wanted = Object.values(profile || {}).join(" ").toLowerCase();
  const score = (p: (typeof products)[number]) =>
    (p.concerns.some((c) => wanted.includes(c)) ? 2 : 0) +
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

function systemPrompt(profile: Record<string, string> | undefined, lang: string) {
  const profileText =
    profile && Object.keys(profile).length
      ? Object.entries(profile)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : "not provided yet";

  return `You are the Smoothlife.com AI Beauty Advisor — a warm, knowledgeable skincare and wellness consultant for a Thai health & beauty retailer.

Reply in ${lang === "en" ? "English" : "Thai"}. Keep answers short and practical: 2-4 short paragraphs or a tight bullet list.

FORMATTING — this is a plain-text chat bubble, not a markdown renderer:
- Do NOT use markdown at all: no **bold**, no _italic_, no # headings, no numbered/lettered lists. Plain sentences only (a simple "- " bullet per line is OK if you need a short list).
- Product names inside sentences should be written as plain text, not bolded.

HOW TO RECOMMEND A PRODUCT — this matters and must be followed exactly:
You may only recommend products from the catalogue below. Mention at most 3 products per reply. Never invent products, prices or medical claims.
When you name a product, put its slug on its own line right after the sentence, wrapped in DOUBLE square brackets — exactly two on each side, e.g.:
เซตนี้ช่วยลดจุดด่างดำได้ดีค่ะ
[[smooth-e-cream-40g]]
Never use a single bracket like [smooth-e-cream-40g] — it must be [[double-bracketed]] or the app cannot turn it into a product card. The app renders each correctly-formatted marker as a tappable card with photo, price and an add-to-cart button, so never write out the URL or the price yourself — just the marker, using the slug exactly as it appears in the first column below.

CATALOGUE (slug | name | brand | price | category | concerns):
${catalogue(profile)}

Guidance:
- Ground advice in ingredients and routine order (cleanse, treat, moisturise, SPF).
- If a question suggests a medical condition (severe acne, infection, allergic reaction, pregnancy), recommend seeing a dermatologist or pharmacist and keep product advice gentle and general.
- Never promise results or claim to treat disease.
- If asked something unrelated to beauty, health or the store, politely steer back.`;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const profile = body?.profile;
  const lang = body?.lang === "en" ? "en" : "th";
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return NextResponse.json({
      reply:
        lang === "en"
          ? "The AI Advisor isn't connected yet. Add an ANTHROPIC_API_KEY environment variable in your Vercel project settings and redeploy to enable live chat. In the meantime, the personalised product picks above are based on your quiz answers."
          : "ยังไม่ได้เชื่อมต่อ AI Advisor ครับ — กรุณาเพิ่มค่า ANTHROPIC_API_KEY ใน Environment Variables ของโปรเจกต์บน Vercel แล้ว deploy ใหม่ เพื่อเปิดใช้งานแชทสด ระหว่างนี้สินค้าที่แนะนำด้านบนคัดมาจากคำตอบในแบบประเมินของคุณแล้วครับ",
      configured: false,
    });
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: systemPrompt(profile, lang),
        messages: messages
          .filter((m: any) => m && typeof m.content === "string" && m.content.trim())
          .slice(-12)
          .map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[anthropic] status=" + res.status + " model=" + MODEL + " body=" + detail.slice(0, 500));
      return NextResponse.json(
        {
          reply:
            lang === "en"
              ? "Sorry, I couldn't reach the AI service just now. Please try again."
              : "ขออภัยครับ ตอนนี้เชื่อมต่อบริการ AI ไม่ได้ กรุณาลองใหม่อีกครั้ง",
          configured: true,
          error: detail.slice(0, 300),
        },
        { status: 200 }
      );
    }

    const data = await res.json();
    const reply = (data?.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ reply: reply || "…", configured: true });
  } catch (e: any) {
    console.error("[anthropic] threw " + String(e));
    return NextResponse.json({
      reply:
        lang === "en"
          ? "Sorry, something went wrong. Please try again."
          : "ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      configured: true,
      error: String(e).slice(0, 200),
    });
  }
}
