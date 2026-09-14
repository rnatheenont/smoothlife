import { NextRequest, NextResponse } from "next/server";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { CONCERN_KEYS, normaliseConcern, type ConcernResults } from "@/lib/skin-analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Up to six photos, and the model thinks before it answers: well past the
// 10-15 s some plans default a function to.
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

// Scoring is anchored to what can be seen, concern by concern and area by
// area, and the model has to write down what it sees before it scores.
// Without anchors it answered most faces with the same mid-range numbers.
const SYSTEM_PROMPT = `You are a cosmetic skin-appearance analyser for a Thai beauty retailer's website. You are given 1-6 photos of the same person's face, each labelled with what it shows (front, left/right cheek, forehead, under-eye, chin, or a spot they are concerned about). The FIRST photo is the front view. Assess 12 visible surface concerns, each overall and per face area, plus an estimated visible "skin age".

FACE AREAS (always as they appear in the FRONT photo — "Left"/"Right" mean the left/right side of that IMAGE, not the person's own left/right):
forehead · nose · cheekLeft · cheekRight · underEyeLeft · underEyeRight · chin

CONCERNS — "severity" 0-100, higher = more visible issue. Rate the areas listed for each concern:
- acne (active blemishes, bumps, red breakout marks) — forehead, nose, cheekLeft, cheekRight, chin. 0-10 none · 11-25 one to three small spots · 26-45 several in one area · 46-65 many or across areas · 66-100 widespread/inflamed-looking
- spots (dark spots, patches, post-blemish marks) — forehead, nose, cheekLeft, cheekRight, chin. 0-10 even · 11-25 one or two faint marks · 26-45 several marks · 46-65 noticeable patches · 66-100 extensive
- wrinkles (fine lines/wrinkles) — forehead, underEyeLeft, underEyeRight. 0-10 none · 11-25 faint when expressive · 26-45 fine lines at rest · 46-65 lines in several places · 66-100 deep lines
- texture (roughness, unevenness of surface) — forehead, nose, cheekLeft, cheekRight, chin. 0-10 smooth · 26-45 some visible roughness · 66-100 very uneven
- pores (visible enlarged pores) — forehead, nose, cheekLeft, cheekRight. 0-10 not visible · 11-30 faint on nose · 31-50 nose and inner cheeks · 51-70 across cheeks · 71-100 prominent
- darkCircles (darkness under the eyes) — underEyeLeft, underEyeRight. 0-10 none · 26-45 noticeable shadow · 66-100 very dark
- eyeBags (puffiness under the eyes) — underEyeLeft, underEyeRight. 0-10 flat · 26-45 some puffiness · 66-100 pronounced bags
- redness (visible redness, flushing, irritation) — forehead, nose, cheekLeft, cheekRight, chin. 0-10 none · 26-45 mild patches · 66-100 widespread
- oiliness (shine/greasiness) — forehead, nose, chin. 0-10 matte · 26-45 some shine in T-zone · 66-100 very shiny
- moisture: severity = DRYNESS (flaking, tight dull dryness) — forehead, cheekLeft, cheekRight. 0-10 well hydrated · 26-45 somewhat dry · 66-100 very dry
- radiance: severity = DULLNESS (lack of glow, grey/sallow tone) — forehead, cheekLeft, cheekRight. 0-10 glowing · 26-45 somewhat dull · 66-100 very dull
- firmness: severity = SAGGING (loss of contour, jowls, nasolabial depth) — cheekLeft, cheekRight, chin. 0-10 firm · 26-45 some softening · 66-100 marked sagging

HOW TO SCORE — in this order:
1. Write "evidence": short concrete observations of what is visible in THESE photos, by area. If lighting, blur, makeup or a filter hides something, say so.
2. Score each concern and each of its areas from the evidence using the anchors. Areas differ — do not copy one number to every area. Different faces should almost never get identical scores; use exact numbers (23, 41, 67), not round defaults.
3. Skin age (visible surface only): very smooth, no lines at rest, even tone → 18-24; faint under-eye lines → 25-30; fine lines at rest around eyes/forehead → 31-38; lines in several areas, softer contour → 39-48; deeper lines → 49+. A specific number from the evidence.

STRICT RULES:
- Cosmetic reference only, NOT a medical or dermatological diagnosis. No disease names, no "condition", no treatment claims.
- Skin age describes the SKIN SURFACE only — never a claim about real age, health or ethnicity.
- Only comment on what is visible. Never mention race, ethnicity, gender, health, or anything but visible surface skin.
- If no photo clearly shows a face, or lighting/angle makes assessment impossible, say so honestly instead of guessing.
- Do NOT name, suggest or hint at any product, brand or ingredient.
- Output ONLY valid JSON, nothing outside it, exactly this shape:
{
  "evidence": string (<=100 words, English),
  "faceDetected": boolean,
  "skinAge": { "years": number, "note": string (<=15 words, Thai, warm/playful) },
  "concerns": {
    "<concern>": { "severity": number, "note": string (<=15 words, Thai, says where/what was seen), "zones": { "<area>": number, ...only that concern's areas } },
    ...all 12: acne, spots, wrinkles, texture, pores, darkCircles, eyeBags, redness, oiliness, moisture, radiance, firmness
  },
  "overallNote": string (<=25 words, Thai, warm and encouraging, no product mentions),
  "advice": string (<=45 words, Thai, 2-3 practical everyday care tips for the top concerns, no product or brand names),
  "disclaimer": "ผลนี้เป็นการประเมินเบื้องต้นเพื่อความสวยงามจากภาพถ่ายเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์ หากมีความกังวลด้านผิวหนัง ควรปรึกษาแพทย์ผิวหนัง"
}
If faceDetected is false, still return the shape with every severity and skinAge.years set to 0 and notes explaining the photo(s) could not be assessed.`;

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

const DISCLAIMER =
  "ผลนี้เป็นการประเมินเบื้องต้นเพื่อความสวยงามจากภาพถ่ายเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์ หากมีความกังวลด้านผิวหนัง ควรปรึกษาแพทย์ผิวหนัง";

/**
 * Makes the model's JSON safe for the page: all twelve concerns present and
 * clamped, areas limited to each concern's own, notes as strings, the
 * disclaimer always there. The four fields older screens read (acne, pores,
 * darkSpots, wrinkles) are filled from the concerns so nothing downstream
 * changes. "evidence" — the model's working — is dropped. Only an explicit
 * `faceDetected: false` counts as "no face".
 */
function normalise(raw: any) {
  const str = (v: unknown, fallback = "") => (typeof v === "string" ? v.slice(0, 300) : fallback);
  const concerns = {} as ConcernResults;
  for (const key of CONCERN_KEYS) {
    const c = normaliseConcern(key, raw?.concerns?.[key]);
    if (!c) return null;
    concerns[key] = c;
  }
  const yearsRaw = typeof raw?.skinAge?.years === "number" ? raw.skinAge.years : parseFloat(raw?.skinAge?.years);
  if (!Number.isFinite(yearsRaw)) return null;
  const years = Math.round(Math.min(100, Math.max(0, yearsRaw)));
  const legacy = (k: keyof ConcernResults) => ({ score: concerns[k].severity, note: concerns[k].note });
  return {
    faceDetected: raw?.faceDetected !== false && years > 0,
    skinAge: { years, note: str(raw?.skinAge?.note) },
    acne: legacy("acne"),
    pores: legacy("pores"),
    darkSpots: legacy("spots"),
    wrinkles: legacy("wrinkles"),
    concerns,
    overallNote: str(raw?.overallNote),
    advice: str(raw?.advice),
    disclaimer: str(raw?.disclaimer, DISCLAIMER) || DISCLAIMER,
  };
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
  if (totalSize > 4_000_000) {
    return NextResponse.json(
      { error: "image_too_large", message: "รูปใหญ่เกินไป ลองถ่ายใหม่หรือใช้จำนวนมุมน้อยลง" },
      { status: 413 }
    );
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "ระบบวิเคราะห์ผิวยังไม่พร้อมใช้งานในตอนนี้ กรุณาลองใหม่ภายหลัง",
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
        // Sonnet 5 thinks by default and thinking counts against this cap;
        // at 1000 a long look at six photos could be cut off before the JSON.
        max_tokens: 8000,
        // Twelve concerns across seven areas is a long answer; medium effort
        // keeps the whole call inside the function's 60 s.
        output_config: { effort: "medium" },
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
    if (data?.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "refused", message: "ระบบวิเคราะห์รูปนี้ไม่ได้ ลองถ่ายใหม่ให้เห็นผิวหน้าชัดๆ" },
        { status: 200 }
      );
    }
    if (data?.stop_reason === "max_tokens") {
      console.error("[skin-coach] hit max_tokens before finishing the JSON");
    }
    const text = (data?.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    const parsed = extractJson(text);
    if (!parsed || !normalise(parsed)) {
      return NextResponse.json(
        { error: "parse_error", message: "ขออภัยครับ ผลวิเคราะห์ไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง" },
        { status: 200 }
      );
    }

    return NextResponse.json({ result: normalise(parsed) });
  } catch (e: any) {
    console.error("[skin-coach] threw " + String(e));
    return NextResponse.json(
      { error: "server_error", message: "ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
      { status: 200 }
    );
  }
}
