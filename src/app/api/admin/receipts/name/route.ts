import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { loadCampaignContent } from "@/lib/receipt-campaign-content";
import { campaignKeyFrom, listCampaigns } from "@/lib/receipt-campaign-keys";

// What the campaign is called, for the places that only need its name.
//
// The settings endpoint answers this too, but it carries the whole catalogue
// with it — and the sidebar asks on every admin page, not just this one.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const key = campaignKeyFrom(req.nextUrl.searchParams.get("campaign"));
  const [content, campaigns] = await Promise.all([loadCampaignContent(key), listCampaigns()]);
  return NextResponse.json({ ok: true, key, name: content.eyebrow, title: content.title, campaigns });
}
