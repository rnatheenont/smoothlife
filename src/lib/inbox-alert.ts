// Telling the support team a case is waiting, once.
//
// Until now the only thing that said "somebody needs an answer" was a number
// on a screen nobody has open. A case could sit in waiting_human all afternoon
// and the first anyone knew was the customer asking again.
//
// Same discipline as gift-stock-alert.ts, for the same reason: this reports a
// *crossing* — the moment a case goes over the line — and remembers that it
// did, so the mail is about what changed rather than a list of the same four
// cases every ten minutes, which is the version nobody reads by lunchtime.
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { emailConfigured, sendEmail } from "@/lib/email";
import { pushLineText, linePushConfigured } from "@/lib/line-push";

/** How long a case may sit unanswered before it is worth interrupting someone. */
export const WAITING_MINUTES = 15;

type Reason = "urgent" | "waiting";

type Waiting = {
  id: string;
  channel: string;
  subject: string | null;
  urgency: string;
  last_message_at: string;
};

export type InboxAlertResult = {
  checked: number;
  newlyUrgent: Waiting[];
  newlyWaiting: Waiting[];
  emailed: string | null;
  /** true when the LINE message went out, false when it was tried and failed,
   *  null when there is nowhere to send it. */
  lined: boolean | null;
  skipped?: string;
};

/** The team's own LINE group or a staff member's LINE id — never the customer
 *  OA. Pushing a "come and answer this" message down the channel customers
 *  read would be the worst possible place for it, so this is a separate
 *  setting with a separate value, and nothing falls back to the OA. */
const lineTarget = () => process.env.INBOX_ALERT_LINE_TO?.trim() || "";

/** Short enough to read on a lock screen, with the link to act on. */
function lineAlertText(urgent: Waiting[], waiting: Waiting[], baseUrl: string): string {
  const line = (c: Waiting) =>
    `• ${c.subject ? c.subject.slice(0, 60) : "ไม่มีหัวข้อ"} (${c.channel}, รอ ${minutesSince(c.last_message_at)} นาที)\n  ${baseUrl}/admin/inbox?id=${c.id}`;
  const parts: string[] = [];
  if (urgent.length > 0) parts.push(`🚩 เคสด่วน ${urgent.length} เคส\n${urgent.map(line).join("\n")}`);
  if (waiting.length > 0)
    parts.push(`⏳ รอเกิน ${WAITING_MINUTES} นาที ${waiting.length} เคส\n${waiting.map(line).join("\n")}`);
  return `มีลูกค้ารอคำตอบอยู่\n\n${parts.join("\n\n")}`;
}

const minutesSince = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000);

function alertHtml(urgent: Waiting[], waiting: Waiting[], baseUrl: string): string {
  const row = (c: Waiting) =>
    `<tr>
      <td style="padding:6px 12px 6px 0">
        <a href="${baseUrl}/admin/inbox?id=${c.id}" style="color:#05755f;font-weight:600;text-decoration:none">${
          c.subject ? c.subject.replace(/</g, "&lt;").slice(0, 80) : "ไม่มีหัวข้อ"
        }</a>
        <span style="color:#94a3b8;font-size:12px"> · ${c.channel}</span>
      </td>
      <td style="padding:6px 0;text-align:right;white-space:nowrap">รอมา ${minutesSince(c.last_message_at)} นาที</td>
    </tr>`;
  const section = (title: string, items: Waiting[]) =>
    items.length === 0
      ? ""
      : `<p style="margin:18px 0 6px;font-weight:700">${title}</p><table style="border-collapse:collapse;font-size:14px">${items
          .map(row)
          .join("")}</table>`;
  return `<div style="font-family:system-ui,-apple-system,'Helvetica Neue',sans-serif;color:#0f172a;line-height:1.6">
  <p style="font-size:16px;font-weight:700;margin:0 0 4px">มีลูกค้ารอคำตอบอยู่</p>
  <p style="margin:0;color:#475569;font-size:13px">กดที่หัวข้อเพื่อเปิดเคสในหน้าแอดมินได้เลย</p>
  ${section("เคสด่วน", urgent)}
  ${section(`รอเกิน ${WAITING_MINUTES} นาที`, waiting)}
  <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">แจ้งครั้งเดียวต่อหนึ่งเคส — เคสเดิมจะไม่ถูกแจ้งซ้ำ</p>
</div>`;
}

/**
 * Looks at what is waiting, reports what has newly crossed the line, and
 * remembers what it said. Never throws: a scheduler that dies takes every
 * later run with it.
 */
export async function checkWaitingCases(): Promise<InboxAlertResult> {
  const to = process.env.INBOX_ALERT_EMAIL;
  const empty: InboxAlertResult = { checked: 0, newlyUrgent: [], newlyWaiting: [], emailed: null, lined: null };

  const open = await supabaseRest<Waiting[]>(
    `conversations?status=eq.waiting_human&select=id,channel,subject,urgency,last_message_at` +
      `&order=last_message_at.asc&limit=50`
  ).catch((): Waiting[] => []);
  if (open.length === 0) return empty;

  // A case qualifies either by being flagged or by having waited. Flagged ones
  // are listed first and separately: "this one is angry" and "this one has
  // been ignored" are different asks of whoever reads the mail.
  const urgent = open.filter((c) => c.urgency === "urgent");
  const waited = open.filter((c) => c.urgency !== "urgent" && minutesSince(c.last_message_at) >= WAITING_MINUTES);
  const candidates = [...urgent, ...waited];
  const result: InboxAlertResult = { ...empty, checked: open.length };
  if (candidates.length === 0) return result;

  // Claimed before the mail is written, not after. A failed send then costs
  // one missed notice; claiming afterwards would risk a crash between send and
  // claim, and the same four cases arriving every ten minutes forever.
  const alreadyAlerted = await supabaseRest<{ conversation_id: string }[]>(
    `inbox_alerts?conversation_id=in.(${candidates.map((c) => pgValue(c.id)).join(",")})&select=conversation_id`
  ).catch((): { conversation_id: string }[] => []);
  const seen = new Set(alreadyAlerted.map((r) => r.conversation_id));

  result.newlyUrgent = urgent.filter((c) => !seen.has(c.id));
  result.newlyWaiting = waited.filter((c) => !seen.has(c.id));
  const fresh = [...result.newlyUrgent, ...result.newlyWaiting];
  if (fresh.length === 0) return result;

  const rows = fresh.map((c) => ({
    conversation_id: c.id,
    reason: (c.urgency === "urgent" ? "urgent" : "waiting") as Reason,
    alerted_at: new Date().toISOString(),
  }));
  await supabaseRest("inbox_alerts?on_conflict=conversation_id", {
    method: "POST",
    returning: false,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows),
  }).catch((err) => console.error("[inbox-alert] could not record alerts", err));

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.smoothlife.com";

  // Two ways out, tried independently. A team that reads LINE and not email
  // should still get told when the mail server is misconfigured, and the
  // other way round — so neither failure is allowed to skip the other.
  const line = lineTarget();
  if (line && linePushConfigured()) {
    result.lined = await pushLineText(
      line,
      lineAlertText(result.newlyUrgent, result.newlyWaiting, baseUrl)
    );
  }

  if (to && emailConfigured()) {
    const subject =
      result.newlyUrgent.length > 0
        ? `[ด่วน] มีลูกค้ารอคำตอบ ${fresh.length} เคส`
        : `มีลูกค้ารอคำตอบ ${fresh.length} เคส`;
    try {
      await sendEmail(to, subject, alertHtml(result.newlyUrgent, result.newlyWaiting, baseUrl));
      result.emailed = to;
    } catch (err) {
      console.error("[inbox-alert] could not send", err);
    }
  }

  // Said plainly rather than silently: a case was claimed as alerted, and if
  // neither channel is set up, nobody was actually told.
  const missing: string[] = [];
  if (!to || !emailConfigured()) missing.push("อีเมล (INBOX_ALERT_EMAIL)");
  if (!line || !linePushConfigured()) missing.push("LINE (INBOX_ALERT_LINE_TO)");
  if (missing.length === 2) return { ...result, skipped: `ยังไม่ได้ตั้งค่าช่องทางแจ้งเตือน: ${missing.join(" และ ")}` };
  if (missing.length === 1) return { ...result, skipped: `ยังไม่ได้ตั้งค่า${missing[0]}` };
  return result;
}

/**
 * Forgets a case once it has been answered or closed, so the next time it
 * falls behind it is news again. Called when staff reply and when a case is
 * resolved — without this, a customer who comes back to a case that was
 * already alerted once would never raise a second one.
 */
export async function clearInboxAlert(conversationId: string) {
  await supabaseRest(`inbox_alerts?conversation_id=eq.${pgValue(conversationId)}`, {
    method: "DELETE",
    returning: false,
  }).catch((err) => console.error("[inbox-alert] could not clear", err));
}
