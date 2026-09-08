import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredAttachments, ATTACHMENT_RETENTION_DAYS } from "@/lib/chat-attachments";

// The backstop behind "deleted within 30 days at the latest".
//
// Closing a case deletes its photos immediately; this catches the cases nobody
// closes. Without it that sentence in the consent text would only be true of
// conversations someone remembered to tidy up.

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const removed = await purgeExpiredAttachments();
  return NextResponse.json({ ok: true, retentionDays: ATTACHMENT_RETENTION_DAYS, removed });
}
