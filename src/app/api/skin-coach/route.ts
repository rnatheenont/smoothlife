import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `You are a cosmetic skin-appearance scanner for a Thai beauty retailer's website, similar in spirit to a "skin coach" selfie tool. You are given 1-6 close-up selfie photos of the same person's face/skin, each labeled with which area it shows (e.g. front, forehead, cheek, under-eye, chin, or a specific problem spot). Look across all provided photos together, weighting each toward the traits it's best suited to show, and score four visible surface traits, plus an estimated visible "skin age".

STRICT RULES:
- This is entertainment/reference only, NOT a medical or dermatological diagnosis. Never use clinical or diagnostic language (no disease names, no "condition", no treatment claims).
- "Skin age" is a lighthearted cosmetic estimate of how the SKIN SURFACE looks (texture, tone evenness, visible fine lines) — not a claim about the person's real age, health, or ethnicity. Keep it a plausible number reasonably close to typical adult skin (roughly 16-70), phrased playfully, never as a definitive judgment.
- Only comment on what is visibly in the photo(s). Do not guess at causes.
- If no photo clearly shows a face, or lighting/angle makes it impossible to assess, say so honestly instead of guessing.
- Never mention or infer race, ethnicity, exact real age, gender, health conditions, or anything unrelated to visible surface skin texture.
- Do NOT name, suggest, or hint at any product, brand, or ingredient — that is handled elsewhere by our own catalogue, never by you.
- Output ONLY valid JSON, no markdown fences, no commentary outside the JSON, matching exactly this shape:
{
  "faceDetected": boolean,
  "skinAge": { "years": number (a single plausible estimate), "note": string (<=15 words, Thai, warm/playful tone) },
  "acne": { "score": number (0-100, higher = more visible blemishes/breakouts), "note": string (<=15 words, Thai) },
  "pores": { "score": number (0-100, higher = more visible enlarged pores), "note": string (<=15 words, Thai) },
  "darkSpots": { "score": number (0-100, higher = more visible dark spots/uneven tone), "note": string (<=15 words, Thai) },
  "wrinkles": { "score": number (0-100, higher = more visible fine lines/wrinkles), "note": string (<=15 words, Thai) },
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
        max_tokens: 600,
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

    return NextResponse.json({ result: parsed });
  } catch (e: any) {
    console.error("[skin-coach] threw " + String(e));
    return NextResponse.json(
      { error: "server_error", message: "ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
      { status: 200 }
    );
  }
}
