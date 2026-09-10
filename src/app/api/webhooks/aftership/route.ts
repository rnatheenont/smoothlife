import { NextRequest, NextResponse } from "next/server";
import { normaliseTracking, verifyWebhookSignature, SIGNATURE_HEADERS } from "@/lib/aftership";
import { saveTracking } from "@/lib/shipment-store";

// Courier scans arriving on their own.
//
// This is the half that makes tracking feel alive: the customer's page changes
// because the parcel moved, not because someone opened the page. Every request
// is verified against the account's webhook secret first — an endpoint that
// writes parcel statuses on anyone's say-so would let a stranger tell our
// customers their order was delivered.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Read raw: the signature covers the exact bytes, and JSON.parse then
  // re-stringify would change them.
  const raw = await req.text();
  const signed = SIGNATURE_HEADERS.some((h) => verifyWebhookSignature(raw, req.headers.get(h)));
  if (!signed) {
    // Logged with the header names actually present, because "AfterShip is
    // configured but nothing ever updates" is otherwise a silent mystery, and
    // the answer is usually that the secret was pasted from the wrong page.
    console.error(
      "[aftership-webhook] rejected — headers present:",
      [...req.headers.keys()].filter((k) => k.includes("sign") || k.includes("hmac")).join(",") || "none"
    );
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: { msg?: { tracking?: unknown }; data?: { tracking?: unknown } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  // AfterShip has moved this between envelopes across versions; both are read
  // so a version bump on their side does not silently stop the feed.
  const payload = (body?.msg?.tracking ?? body?.data?.tracking ?? null) as Parameters<typeof normaliseTracking>[0] | null;
  const tracking = payload ? normaliseTracking(payload) : null;
  if (!tracking) {
    console.error("[aftership-webhook] no tracking in payload", raw.slice(0, 300));
    // 200 on purpose: a retry would deliver the same unreadable body forever.
    return NextResponse.json({ ok: true, ignored: true });
  }

  await saveTracking(tracking);
  return NextResponse.json({ ok: true });
}
