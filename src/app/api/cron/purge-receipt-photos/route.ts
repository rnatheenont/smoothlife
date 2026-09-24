import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredReceiptPhotos, RECEIPT_RETENTION_DAYS } from "@/lib/receipt-photos";
import { loadCampaignContent } from "@/lib/receipt-campaign-content";

// Receipt photos do not need to outlive the campaign that asked for them.
//
// The clock starts at the close of submissions rather than at upload, because
// a photo sent on the first day is still the evidence behind a prize awarded
// in November. Counting from the end keeps every receipt for the same length
// of time after the thing they are evidence for is over.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPAIGN = "dentiste-x-kengnamping";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const content = await loadCampaignContent(CAMPAIGN);
  const keepUntil = content.closesAt + RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() < keepUntil) {
    return NextResponse.json({ ok: true, skipped: "campaign still within retention", keepUntil });
  }

  const removed = await purgeExpiredReceiptPhotos(new Date(content.closesAt));
  return NextResponse.json({ ok: true, retentionDays: RECEIPT_RETENTION_DAYS, removed });
}
