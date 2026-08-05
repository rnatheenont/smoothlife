import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

// Cosmetic-only, non-diagnostic system prompt. Kept strict on purpose:
// this feature must never read as a medical or dermatological diagnosis.
const SYSTEM_PROMPT = `You are a cosmetic skin-appearance assistant for a Thai beauty retailer's website. You look at a single selfie-style face photo and give a light, cosmetic, non-medical impression of visible skin texture — nothing more.

STRICT RULES:
- This is entertainment/reference only, NOT a medical or dermatological diagnosis. Never use clinical or diagnostic language (no disease names, no "condition", no treatment claims).
- Only comment on what is visibly in the photo: general impression of visible blemishes/acne-like spots, visible dark-spot/uneven-tone areas, and visible fine lines/wrinkles. Do not guess at causes.
- If the photo does not clearly show a face, or lighting/angle makes it impossible to assess, say so honestly instead of guessing.
- Never mention or infer race, ethnicity, age beyond a broad adult/non-adult guess, gender, health conditions, or anything unrelated to visible surface skin texture.
- Never recommend a specific product or brand.
- Output ONLY valid JSON, no markdown fences, no commentary outside the JSON, matching exactly this shape:
{
  "faceDetected": boolean,
  "acne": { "score": number (0-100, lower = clearer), "note": string (<=15 words, Thai) },
  "darkSpots": { "score": number (0-100, lower = more even tone), "note": string (<=15 words, Thai) },
  "wrinkles": { "score": number (0-100, lower = smoother), "note": string (<=15 words, Thai) },
  "overallNote": string (<=25 words, Thai, warm and encouraging, never alarming),
  "disclaimer": "ผลนี้เป็นการประเมินเบื้องต้นเพื่อความสวยงามจากภาพถ่ายเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์ หากมีความกังวลด้านผิวหนัง ควรปรึกษาแพทย์ผิวหนัง"
}
If faceDetected is false, still return the shape with scores set to 0 and notes explaining the photo could not be assessed.`;

function extractJson(text: string): any | null {
  const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const base64 = typeof body?.base64 === "string" ? body.base64 : "";
  const mediaType = body?.mediaType === "image/png" ? "image/png" : "image/jpeg";

  if (!base64 || base64.length < 100) {
    return NextResponse.json({ error: "missing image" }, { status: 400 });
  }
  // Rough cap so someone can't post an enormous payload to this route.
  if (base64.length > 6_000_000) {
    return NextResponse.json({ error: "image too large" }, { status: 413 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "ยังไม่ได้เชื่อมต่อระบบวิเคราะห์ผิวครับ กรุณาเพิ่มค่า ANTHROPIC_API_KEY ใน Environment Variables แล้ว deploy ใหม่",
      },
      { status: 200 }
    );
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
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: "ประเมินภาพนี้ตามรูปแบบ JSON ที่กำหนด",
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[skin-analysis] status=" + res.status + " body=" + detail.slice(0, 500));
      return NextResponse.json(
        { error: "upstream_error", message: "ขออภัยครับ ตอนนี้วิเคราะห์รูปไม่ได้ กรุณาลองใหม่อีกครั้ง" },
        { status: 200 }
      );
    }

    const data = await res.json();
    const text = (data?.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    const parsed = extractJson(text);
    if (!parsed) {
      return NextResponse.json(
        { error: "parse_error", message: "ขออภัยครับ ผลวิเคราะห์ไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง" },
        { status: 200 }
      );
    }

    return NextResponse.json({ result: parsed });
  } catch (e: any) {
    console.error("[skin-analysis] threw " + String(e));
    return NextResponse.json(
      { error: "server_error", message: "ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
      { status: 200 }
    );
  }
}
