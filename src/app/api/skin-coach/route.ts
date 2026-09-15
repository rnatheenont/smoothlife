import { NextRequest, NextResponse } from "next/server";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { logAiUsage } from "@/lib/ai-usage";
import { CONCERN_KEYS, concernFromLevels, skinAgeFromBand, type ConcernResults } from "@/lib/skin-analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Up to six photos, and the model thinks before it answers: well past the
// 10-15 s some plans default a function to.
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

// Scoring is anchored to what can be seen, concern by concern and area by
// area, and the model writes down what it sees before it rates anything.
//
// Each area gets a LEVEL (0–4), not a free number: asked for "exact numbers",
// the same face photographed seconds apart came back with very different
// scores, because the model cannot tell 23 from 31 and was told to pick one
// anyway. Levels are turned into scores in code (lib/skin-analysis).
const SYSTEM_PROMPT = `You are a cosmetic skin-appearance analyser for a Thai beauty retailer's website. You are given 1-6 photos of the same person's face, each labelled with what it shows (front, left/right cheek, forehead, under-eye, chin, or a spot they are concerned about). The FIRST photo is the front view. Rate 12 visible surface concerns in each face area, estimate the visible "skin age", and report the photo's quality.

FACE AREAS (always as they appear in the FRONT photo — "Left"/"Right" mean the left/right side of that IMAGE, not the person's own left/right):
forehead · nose · cheekLeft · cheekRight · underEyeLeft · underEyeRight · chin

CONCERNS — rate each listed area with a LEVEL 0-4 using these anchors (what is visible IN THAT AREA):
- acne (active blemishes, bumps, red breakout marks) — forehead, nose, cheekLeft, cheekRight, chin. 0 none · 1 one to three small spots · 2 several · 3 many · 4 widespread or inflamed-looking
- spots (dark spots, patches, post-blemish marks) — forehead, nose, cheekLeft, cheekRight, chin. 0 even tone · 1 one or two faint marks · 2 several marks · 3 noticeable patches · 4 extensive
- wrinkles (fine lines/wrinkles) — forehead, underEyeLeft, underEyeRight. 0 none · 1 faint, only when expressive · 2 fine lines at rest · 3 clear lines · 4 deep lines
- texture (roughness, unevenness of surface) — forehead, nose, cheekLeft, cheekRight, chin. 0 smooth · 1 slight unevenness · 2 some visible roughness · 3 clearly rough or bumpy · 4 very uneven
- pores (visible enlarged pores) — forehead, nose, cheekLeft, cheekRight. 0 not visible · 1 faint · 2 visible at normal distance · 3 enlarged, clearly visible · 4 prominent across the area
- darkCircles (darkness under the eyes) — underEyeLeft, underEyeRight. 0 none · 1 faint shadow · 2 noticeable shadow · 3 dark · 4 very dark
- eyeBags (puffiness under the eyes) — underEyeLeft, underEyeRight. 0 flat · 1 slight puffiness · 2 some puffiness · 3 clear bags · 4 pronounced bags
- redness (visible redness, flushing, irritation) — forehead, nose, cheekLeft, cheekRight, chin. 0 none · 1 faint flush · 2 mild patches · 3 clear redness · 4 widespread
- oiliness (shine/greasiness of the skin itself) — forehead, nose, chin. 0 matte · 1 slight sheen · 2 some shine · 3 shiny · 4 very shiny
- moisture — rate DRYNESS — forehead, cheekLeft, cheekRight. 0 well hydrated · 1 slightly dry · 2 somewhat dry or tight-looking · 3 dry with flaking · 4 very dry
- radiance — rate DULLNESS — forehead, cheekLeft, cheekRight. 0 glowing · 1 slightly dull · 2 somewhat dull · 3 dull or sallow · 4 very dull or grey
- firmness — rate SAGGING — cheekLeft, cheekRight, chin. 0 firm · 1 slight softening · 2 some softening · 3 clear sagging · 4 marked sagging

HOW TO RATE — in this order:
1. Write "evidence": short concrete observations of what is visible in THESE photos, by area.
2. Rate every listed area of every concern with a level from the anchors. Rate each area on its own.
3. Be consistent: the same face in similar photos must get the same levels. When an area sits between two levels, choose the LOWER one unless the higher is clearly visible. Judge the skin, not the light: glare from a lamp or flash is not oiliness, a shadow from overhead light is not dark circles, a colour cast from the camera is not redness or dullness.
4. Skin age (visible surface only) — pick a band: 0 very smooth, no lines at rest, even tone (18-24) · 1 faint under-eye lines (25-30) · 2 fine lines at rest around eyes/forehead (31-38) · 3 lines in several areas, softer contour (39-48) · 4 deeper lines (49+). Then where in the band: "low", "mid" or "high".
5. Photo quality: lighting "good", "dim", "harsh" (strong glare or hard shadows) or "uneven" (one side much brighter); "sharp" false if blurry; "filterOrMakeup" true if a beauty filter, smoothing or visible makeup hides the skin.

STRICT RULES:
- Cosmetic reference only, NOT a medical or dermatological diagnosis. No disease names, no "condition", no treatment claims.
- Skin age describes the SKIN SURFACE only — never a claim about real age, health or ethnicity.
- Only comment on what is visible. Never mention race, ethnicity, gender, health, or anything but visible surface skin.
- If no photo clearly shows a face, set faceDetected false instead of guessing.
- Do NOT name, suggest or hint at any product, brand or ingredient.
- Output ONLY valid JSON, nothing outside it, exactly this shape:
{
  "evidence": string (<=100 words, English),
  "faceDetected": boolean,
  "photoQuality": { "lighting": "good" | "dim" | "harsh" | "uneven", "sharp": boolean, "filterOrMakeup": boolean },
  "skinAge": { "band": 0-4, "position": "low" | "mid" | "high", "note": string (<=15 words, Thai, warm/playful) },
  "concerns": {
    "<concern>": { "note": string (<=15 words, Thai, says where/what was seen), "zones": { "<area>": 0-4, ...only that concern's areas } },
    ...all 12: acne, spots, wrinkles, texture, pores, darkCircles, eyeBags, redness, oiliness, moisture, radiance, firmness
  },
  "overallNote": string (<=25 words, Thai, warm and encouraging, no product mentions),
  "advice": string (<=45 words, Thai, 2-3 practical everyday care tips for the top concerns, no product or brand names),
  "disclaimer": "ผลนี้เป็นการประเมินเบื้องต้นเพื่อความสวยงามจากภาพถ่ายเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์ หากมีความกังวลด้านผิวหนัง ควรปรึกษาแพทย์ผิวหนัง"
}
If faceDetected is false, still return the shape with every level 0 and notes explaining the photo(s) could not be assessed.`;

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
 * Makes the model's JSON safe for the page: all twelve concerns present, area
 * levels turned into scores, skin age from its band, notes as strings, the
 * disclaimer always there. The four fields older screens read (acne, pores,
 * darkSpots, wrinkles) are filled from the concerns so nothing downstream
 * changes. "evidence" — the model's working — is dropped. Only an explicit
 * `faceDetected: false` counts as "no face".
 */
function normalise(raw: any) {
  const str = (v: unknown, fallback = "") => (typeof v === "string" ? v.slice(0, 300) : fallback);
  const concerns = {} as ConcernResults;
  for (const key of CONCERN_KEYS) {
    const c = concernFromLevels(key, raw?.concerns?.[key]);
    if (!c) return null;
    concerns[key] = c;
  }
  const faceDetected = raw?.faceDetected !== false;
  const years = faceDetected ? skinAgeFromBand(raw?.skinAge?.band, raw?.skinAge?.position) : 0;
  if (years === null) return null;
  const legacy = (k: keyof ConcernResults) => ({ score: concerns[k].severity, note: concerns[k].note });
  return {
    faceDetected: faceDetected && years > 0,
    skinAge: { years, note: str(raw?.skinAge?.note) },
    acne: legacy("acne"),
    pores: legacy("pores"),
    darkSpots: legacy("spots"),
    wrinkles: legacy("wrinkles"),
    concerns,
    photoIssues: photoIssues(raw?.photoQuality),
    overallNote: str(raw?.overallNote),
    advice: str(raw?.advice),
    disclaimer: str(raw?.disclaimer, DISCLAIMER) || DISCLAIMER,
  };
}

/** What about the photo may have moved the result, in words for the page. */
function photoIssues(q: any): string[] {
  const issues: string[] = [];
  if (q?.lighting === "dim") issues.push("แสงน้อย");
  else if (q?.lighting === "harsh") issues.push("แสงจ้าหรือมีเงาแข็ง");
  else if (q?.lighting === "uneven") issues.push("แสงสองข้างหน้าไม่เท่ากัน");
  if (q?.sharp === false) issues.push("รูปไม่ค่อยชัด");
  if (q?.filterOrMakeup === true) issues.push("มีฟิลเตอร์หรือเครื่องสำอางบังผิว");
  return issues;
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

  const startedAt = Date.now();
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
    // Measured cost of this scan; see lib/ai-usage.ts.
    const usage = (outcome: string) =>
      logAiUsage({
        feature: "skin-coach",
        model: typeof data?.model === "string" ? data.model : MODEL,
        outcome,
        usage: data?.usage,
        photos: images.length,
        durationMs: Date.now() - startedAt,
      });
    if (data?.stop_reason === "refusal") {
      await usage("refused");
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
      await usage(data?.stop_reason === "max_tokens" ? "max_tokens" : "parse_error");
      return NextResponse.json(
        { error: "parse_error", message: "ขออภัยครับ ผลวิเคราะห์ไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง" },
        { status: 200 }
      );
    }

    await usage(data?.stop_reason === "max_tokens" ? "ok_max_tokens" : "ok");
    return NextResponse.json({ result: normalise(parsed) });
  } catch (e: any) {
    console.error("[skin-coach] threw " + String(e));
    return NextResponse.json(
      { error: "server_error", message: "ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
      { status: 200 }
    );
  }
}
