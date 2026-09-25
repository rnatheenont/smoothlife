import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isRateLimited, isRateLimitedShared } from "@/lib/rate-limit";
import { JOIN_ERROR_TH, joinFlashSale, UUID_RE } from "@/lib/flash-sale";
import { ipLimited, sourceFingerprint, TOO_MANY_TH } from "@/lib/abuse-guard";
import { pgValue, supabaseRest } from "@/lib/supabase-server";

// Join the line for one product. Signed-in shoppers only: the account is what
// "one piece per person" is enforced on, in the database (fs_join).
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนเข้าคิว" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  // A person needs one or two presses; anything faster is a script.
  if (isRateLimited(`fs-join:${userId}`, 10, 60_000) || (await isRateLimitedShared(`fs-join:${userId}`, 20, 60_000))) {
    return NextResponse.json({ ok: false, error: "กดถี่เกินไป รอสักครู่แล้วลองใหม่" }, { status: 429 });
  }

  // And a ceiling the account cannot be changed to get around. One account one
  // slot is the right rule and it does nothing against a hundred accounts
  // joining once each — which is the whole of a flash-sale bot. Twenty joins a
  // minute from one address is far past a household and far short of a farm.
  if (await ipLimited(req, "fs-join", 20, 60_000)) {
    return NextResponse.json({ ok: false, error: TOO_MANY_TH }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const productSlug = typeof body?.productSlug === "string" ? body.productSlug.slice(0, 200) : "";
  if (!productSlug) return NextResponse.json({ ok: false, error: "กรุณาเลือกสินค้า" }, { status: 400 });

  try {
    const result = await joinFlashSale(id, productSlug, userId);
    if ("error" in result) return NextResponse.json({ ok: false, code: result.error, error: JOIN_ERROR_TH[result.error] }, { status: 409 });

    // Where it came from, hashed. Never used to refuse anyone — it is here so
    // that "nine places in this line share one address" is a question the
    // admin screen can answer after the fact, which is the only way anyone
    // finds out a queue was farmed.
    const source = sourceFingerprint(req);
    if (source) {
      await supabaseRest(`flash_sale_queue?id=eq.${pgValue(result.entry_id)}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ source_hash: source }),
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, entryId: result.entry_id });
  } catch (err) {
    console.error("[flash-sale] join failed", err);
    return NextResponse.json({ ok: false, error: "เข้าคิวไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
