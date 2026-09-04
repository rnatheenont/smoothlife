import { NextRequest, NextResponse } from "next/server";
import { getOrderForGuestTracking, shopifyAdminConfigured } from "@/lib/shopify-admin";
import { isRateLimitedShared, clientIp } from "@/lib/rate-limit";
import { buildTracking } from "@/lib/tracking";

// Signed-out parcel tracking: order number *or* courier tracking number,
// plus the phone or email on the order.
//
// Rate limited by IP rather than by order number on purpose. Limiting per
// order would let someone walk the whole sequence — #4190, #4191, #4192 — one
// guess each and never trip a counter, and sequential order numbers are
// exactly what makes that walk cheap.

export const runtime = "nodejs";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (!shopifyAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบติดตามพัสดุยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  if (await isRateLimitedShared(`track:${clientIp(req)}`, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json(
      { ok: false, error: "ค้นหาบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  // `orderName` is the older field name, still accepted so a page cached in
  // someone's browser keeps working after this deploy.
  const raw = body.reference ?? body.orderName;
  const reference = typeof raw === "string" ? raw.trim() : "";
  const contact = typeof body.contact === "string" ? body.contact.trim() : "";
  if (!reference || !contact) {
    return NextResponse.json(
      { ok: false, error: "กรุณากรอกเลขคำสั่งซื้อหรือเลขพัสดุ และเบอร์โทรหรืออีเมล" },
      { status: 400 }
    );
  }

  const order = await getOrderForGuestTracking(reference, contact);
  // One message for "no such order" and for "that contact isn't on this
  // order" — telling them apart would confirm which order numbers exist.
  if (!order) {
    return NextResponse.json(
      { ok: false, error: "ไม่พบคำสั่งซื้อนี้ กรุณาตรวจสอบเลขที่กรอกและเบอร์โทร/อีเมลอีกครั้ง" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, ...buildTracking(order) });
}
