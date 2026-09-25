import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredReceiptPhotos, RECEIPT_RETENTION_DAYS } from "@/lib/receipt-photos";
import { loadCampaignContent } from "@/lib/receipt-campaign-content";
import { listCampaigns } from "@/lib/receipt-campaign-keys";

// Receipt photos do not need to outlive the campaign that asked for them.
//
// The clock starts at the close of submissions rather than at upload, because
// a photo sent on the first day is still the evidence behind a prize awarded
// in November. Counting from the end keeps every receipt for the same length
// of time after the thing they are evidence for is over.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Every campaign, each on its own clock: one that closed in October is due
  // while one still running is not, and a single date cannot say both.
  const campaigns = await listCampaigns();
  let removed = 0;
  const skipped: string[] = [];
  for (const campaign of campaigns) {
    const content = await loadCampaignContent(campaign.key);
    if (Date.now() < content.closesAt + RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000) {
      skipped.push(campaign.key);
      continue;
    }
    removed += await purgeExpiredReceiptPhotos(new Date(content.closesAt));
  }
  return NextResponse.json({ ok: true, retentionDays: RECEIPT_RETENTION_DAYS, removed, skipped });
}
