import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { loadCampaignContent } from "@/lib/receipt-campaign-content";

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
  const content = await loadCampaignContent("dentiste-x-kengnamping");
  return NextResponse.json({ ok: true, name: content.eyebrow, title: content.title });
}
