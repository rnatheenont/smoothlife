import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_TRANSLATE_MODEL || "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";

// simple in-memory cache shared across requests on a warm lambda
const memo = new Map<string, string>();

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ map: {} });
  }

  const texts: string[] = Array.isArray(body?.texts)
    ? body.texts.filter((t: any) => typeof t === "string" && t.trim()).slice(0, 80)
    : [];
  if (!texts.length) return NextResponse.json({ map: {} });

  const map: Record<string, string> = {};
  const todo: string[] = [];
  texts.forEach((t) => {
    const hit = memo.get(t);
    if (hit) map[t] = hit;
    else todo.push(t);
  });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || todo.length === 0) {
    return NextResponse.json({ map, configured: Boolean(key) });
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
        max_tokens: 4000,
        system:
          "You translate Thai e-commerce UI copy into natural, concise English for a health & beauty website. Keep brand names, product names, numbers, currency symbols and punctuation intact. Match the register and length of the source. Respond with ONLY a JSON array of translated strings, in the same order and with the same length as the input array. No commentary, no code fences.",
        messages: [
          {
            role: "user",
            content: JSON.stringify(todo),
          },
        ],
      }),
    });

    if (!res.ok) return NextResponse.json({ map, configured: true });

    const data = await res.json();
    const raw = (data?.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("")
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();

    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      todo.forEach((src, i) => {
        const out = arr[i];
        if (typeof out === "string" && out.trim()) {
          memo.set(src, out);
          map[src] = out;
        }
      });
    }
  } catch {
    // fall through — untranslated strings simply stay in Thai
  }

  return NextResponse.json({ map, configured: true });
}
