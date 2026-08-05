import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `You are a cosmetic skin-appearance scanner for a Thai beauty retailer's website, similar in spirit to a "skin coach" selfie tool. You look at a single selfie-style face photo and score four visible surface traits only.

STRICT RULES:
- This is entertainment/reference only, NOT a medical or dermatological diagnosis. Never use clinical or diagnostic language (no disease names, no "condition", no treatment claims).
- Only comment on what is visibly in the photo. Do not guess at causes.
- If the photo does not clearly show a face, or lighting/angle makes it impossible to assess, say so honestly instead of guessing.
- Never mention or infer race, ethnicity, exact age, gender, health conditions, or anything unrelated to visible surface skin texture.
- Do NOT name, suggest, or hint at any product, brand, or ingredient — that is handled elsewhere by our own catalogue, never by you.
- Output ONLY valid JSON, no markdown fences, no commentary outside the JSON, matching exactly this shape:
{
  "faceDetected": boolean,
  "acne": { "score": number (0-100, higher = more visible blemishes/breakouts), "note": string (<=15 words, Thai) },
  "pores": { "score": number (0-100, higher = more visible enlarged pores), "note": string (<=15 words, Thai) },
  "darkSpots": { "score": number (0-100, higher = more visible dark spots/uneven tone), "note": string (<=15 words, Thai) },
  "wrinkles": { "score": number (0-100, higher = more visible fine lines/wrinkles), "note": string (<=15 words, Thai) },
  "overallNote": string (<=25 words, Thai, warm and encouraging, never alarming, no product mentions),
  "disclaimer": "ผลนี้เป็นการประเมินเบื้องต้นเพื่อความสวยงามจากภาพถ่ายเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์ หากมีความกังวลด้านผิวหนัง ควรปรึกษาแพทย์ผิวหนัง"
}
If faceDetected is false, still return the shape with all scores set to 0 and notes explaining the photo could not be assessed.`;

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
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
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
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: "ประเมินภาพนี้ตามรูปแบบ JSON ที่กำหนด" },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[skin-coach] status=" + res.status + " body=" + detail.slice(0, 500));
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
    console.error("[skin-coach] threw " + String(e));
    return NextResponse.json(
      { error: "server_error", message: "ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
      { status: 200 }
    );
  }
}
