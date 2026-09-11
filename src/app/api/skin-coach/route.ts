import { NextRequest, NextResponse } from "next/server";
import { aiRateLimit } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

// Scoring is anchored to what can be seen, trait by trait, and the model has
// to write down what it sees before it scores. Without anchors it answered
// most faces with the same mid-range numbers and a skin age in the late
// twenties — different people got the same result and one person got the
// same result under any light, because the scores followed a notion of a
// "typical" face rather than the photo in front of it.
const SYSTEM_PROMPT = `You are a cosmetic skin-appearance scanner for a Thai beauty retailer's website, like a selfie "skin coach". You are given 1-6 photos of the same person's face, each labelled with the area it shows (front, left/right cheek, forehead, under-eye, chin, or a spot they are concerned about). Look across all photos together, weighting each toward what it shows best, and assess four visible surface traits plus an estimated visible "skin age".

HOW TO SCORE — follow this order:
1. First write "evidence": short, concrete observations of what is actually visible in THESE photos — where, how many, how large, how pronounced. Name areas (forehead, T-zone, cheeks, around eyes, jawline). If lighting, blur, makeup or a filter hides a trait, say so.
2. Then score each trait from the evidence, using the anchors below. Scores must follow the evidence, not a sense of what a typical face scores. Two different faces should almost never get identical scores; use the whole range and exact numbers (e.g. 23, 41, 67), not round defaults.

Trait anchors (0-100, higher = more visible):
- acne (active blemishes, bumps, red marks from breakouts): 0-10 none visible · 11-25 one to three small spots · 26-45 several spots in one area · 46-65 many spots or across two or more areas · 66-100 widespread or inflamed-looking
- pores (visible enlarged pores, mostly cheeks/nose/T-zone): 0-10 not visible at this distance · 11-30 faint on the nose only · 31-50 clearly visible on the nose and inner cheeks · 51-70 visible across cheeks · 71-100 prominent over most of the face
- darkSpots (dark spots, patches, post-blemish marks, uneven tone): 0-10 even tone · 11-25 one or two faint marks · 26-45 several marks or mild unevenness · 46-65 noticeable patches or clearly uneven tone · 66-100 extensive pigmentation
- wrinkles (fine lines and wrinkles, around eyes, forehead, smile lines): 0-10 none visible · 11-25 faint lines only when expressive or under the eyes · 26-45 visible fine lines at rest in one area · 46-65 lines in several areas · 66-100 deep lines

Skin age (visible surface only, years): judge from texture smoothness, fine lines at the eyes and forehead, smile-line depth, firmness of the jawline/cheek contour, and tone evenness. Roughly: very smooth, no lines at rest, even tone → 18-24; smooth with faint under-eye lines → 25-30; fine lines at rest around the eyes or forehead → 31-38; lines in several areas and softer contour → 39-48; deeper lines → 49+. Give a specific number from the evidence, not a middle-of-the-road guess.

STRICT RULES:
- Cosmetic reference only, NOT a medical or dermatological diagnosis. Never use clinical or diagnostic language (no disease names, no "condition", no treatment claims).
- Skin age describes how the SKIN SURFACE looks — never a claim about the person's real age, health or ethnicity. Keep the note warm and playful, never a judgment.
- Only comment on what is visible. Do not guess at causes.
- If no photo clearly shows a face, or lighting/angle makes assessment impossible, say so honestly instead of guessing.
- Never mention or infer race, ethnicity, exact real age, gender, health conditions, or anything unrelated to visible surface skin.
- Do NOT name, suggest or hint at any product, brand or ingredient.
- Output ONLY valid JSON, no markdown fences, nothing outside the JSON, exactly this shape:
{
  "evidence": string (<=80 words, English, concrete observations — written first),
  "faceDetected": boolean,
  "skinAge": { "years": number, "note": string (<=15 words, Thai, warm/playful) },
  "acne": { "score": number, "note": string (<=15 words, Thai, says where/what was seen) },
  "pores": { "score": number, "note": string (<=15 words, Thai, says where/what was seen) },
  "darkSpots": { "score": number, "note": string (<=15 words, Thai, says where/what was seen) },
  "wrinkles": { "score": number, "note": string (<=15 words, Thai, says where/what was seen) },
  "overallNote": string (<=25 words, Thai, warm and encouraging, never alarming, no product mentions),
  "disclaimer": "ผลนี้เป็นการประเมินเบื้องต้นเพื่อความสวยงามจากภาพถ่ายเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์ หากมีความกังวลด้านผิวหนัง ควรปรึกษาแพทย์ผิวหนัง"
}
If faceDetected is false, still return the shape with all scores and skinAge.years set to 0 and notes explaining the photo(s) could not be assessed.`;

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

type ImageInput = { base64: string; mediaType: "image/jpeg" | "image/png"; zone?: string };

export async function POST(req: NextRequest) {
  // Each call here bills the Anthropic account, and this endpoint needs no
  // login — cap it before any work happens.
  const limited = await aiRateLimit(req, "skin-coach");
  if (limited) return limited;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Accept either the new multi-angle "images" array or the legacy single
  // "base64"/"mediaType" pair, so nothing else calling this route breaks.
  const rawImages: any[] = Array.isArray(body?.images)
    ? body.images
    : body?.base64
    ? [{ base64: body.base64, mediaType: body.mediaType }]
    : [];

  const images: ImageInput[] = rawImages
    .slice(0, 6)
    .map((i) => ({
      base64: typeof i?.base64 === "string" ? i.base64 : "",
      mediaType: (i?.mediaType === "image/png" ? "image/png" : "image/jpeg") as ImageInput["mediaType"],
      zone: typeof i?.zone === "string" ? i.zone.slice(0, 30) : undefined,
    }))
    .filter((i) => i.base64.length > 100);

  if (images.length === 0) {
    return NextResponse.json({ error: "missing image" }, { status: 400 });
  }
  const totalSize = images.reduce((sum, i) => sum + i.base64.length, 0);
  if (totalSize > 14_000_000) {
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
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              ...images.flatMap((img, i) => [
                {
                  type: "text",
                  text: img.zone ? `ภาพที่ ${i + 1}: มุม "${img.zone}"` : `ภาพที่ ${i + 1}`,
                },
                {
                  type: "image",
                  source: { type: "base64", media_type: img.mediaType, data: img.base64 },
                },
              ]),
              {
                type: "text",
                text:
                  images.length > 1
                    ? `นี่คือภาพถ่ายใบหน้า/ผิวคนเดียวกัน ${images.length} ภาพจากมุมต่างๆ ตามที่ระบุไว้ก่อนแต่ละภาพ ให้ประเมินภาพรวมโดยให้น้ำหนักกับมุมที่เกี่ยวข้องกับแต่ละด้าน (เช่น ภาพขอบตาเน้นดูริ้วรอย, ภาพแก้มเน้นดูสิว/รูขุมขน) แล้วตอบตามรูปแบบ JSON ที่กำหนด`
                    : "ประเมินภาพนี้ตามรูปแบบ JSON ที่กำหนด",
              },
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

    // "evidence" is the model's working, there to make it look before it
    // scores; the page shows the Thai notes instead.
    if (parsed && typeof parsed === "object") delete parsed.evidence;
    return NextResponse.json({ result: parsed });
  } catch (e: any) {
    console.error("[skin-coach] threw " + String(e));
    return NextResponse.json(
      { error: "server_error", message: "ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
      { status: 200 }
    );
  }
}
