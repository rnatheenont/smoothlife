import { NextRequest, NextResponse } from "next/server";
import { quoteDiscountCode } from "@/lib/shopify-discounts";

export const dynamic = "force-dynamic";

// Guessing codes is the obvious way to abuse an endpoint that says whether a
// code is real, so each caller gets a modest budget. Held in memory: it
// resets when the instance does, which is fine for slowing a guesser down.
const ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;

function overBudget(key: string) {
  const now = Date.now();
  const entry = ATTEMPTS.get(key);
  if (!entry || now > entry.resetAt) {
    ATTEMPTS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (overBudget(ip)) {
    return NextResponse.json({ ok: false, reason: "ลองใหม่อีกครั้งในอีกสักครู่นะคะ" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const lines = Array.isArray(body?.lines)
    ? body.lines
        .filter((l: unknown): l is { variantId: string; quantity: number } =>
          Boolean(l) && typeof (l as { variantId?: unknown }).variantId === "string"
        )
        .map((l: { variantId: string; quantity: number }) => ({
          variantId: l.variantId,
          quantity: Math.max(1, Math.min(99, Math.floor(Number(l.quantity) || 1))),
        }))
    : [];

  try {
    const quote = await quoteDiscountCode({ code, lines });
    return NextResponse.json(quote);
  } catch (err) {
    console.error("[api/coupons/quote] failed", err);
    return NextResponse.json({ ok: false, reason: "ตรวจสอบโค้ดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" });
  }
}
