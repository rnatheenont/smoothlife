import { NextRequest, NextResponse } from "next/server";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";
import { orderNumberClaim, claimDigits } from "@/lib/receipt-campaign-claims";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

// Asked while the customer is still typing, so "this number is already in the
// campaign" arrives before they choose a photo and wait for an upload — not
// after it, as a rejection.
export async function GET(req: NextRequest, ctx: { params: Promise<{ campaign: string }> }) {
  const { campaign } = await ctx.params;
  const key = campaignKeyFrom(campaign);
  if (!key) return NextResponse.json({ ok: false }, { status: 404 });

  const number = req.nextUrl.searchParams.get("number") ?? "";
  if (claimDigits(number).length < 3) return NextResponse.json({ ok: true, taken: false, byMe: false });

  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const claim = await orderNumberClaim({ campaign: key, userId: uid ?? "", number }).catch(() => ({
    taken: false,
    byMe: false,
  }));
  return NextResponse.json({ ok: true, ...claim });
}
