import { pushLineText, linePushConfigured } from "@/lib/line-push";
import { SITE_URL } from "@/lib/site-url";

// Asking someone to look before a page goes live, and telling them it was
// asked.
//
// The permission system already stops an editor without pages.publish from
// publishing. What it could not do was let them say "this is ready" — so the
// hand-off happened in a chat message, or in person, or not at all. These two
// functions are the whole of the new part: a request, and a decision.
//
// The LINE ping is best effort and deliberately dumb. It goes to one
// configured destination (PAGE_REVIEW_LINE_TARGET — a group the OA has been
// invited to, or one person's userId), and when that is not set, nothing is
// sent and the request still stands: the admin screen is the source of
// truth, LINE is only a tap on the shoulder. A notification system that can
// lose the request itself is worse than no notification at all.

const TARGET = process.env.PAGE_REVIEW_LINE_TARGET?.trim();

export type ReviewState = "none" | "requested" | "approved" | "changes";

export const REVIEW_LABEL: Record<ReviewState, string> = {
  none: "—",
  requested: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  changes: "ขอให้แก้",
};

/** Where an admin opens this page. Absolute, because it is being read inside
 *  LINE on a phone, where a relative path means nothing. */
export function editorLink(kind: string, slug: string) {
  return `${SITE_URL}/admin/pages/${kind}/${slug}`;
}

export function reviewNotifyConfigured() {
  return Boolean(TARGET) && linePushConfigured();
}

/**
 * Tells the team a page is waiting, if there is anywhere to tell.
 *
 * Never throws and never blocks the request that caused it: the row is
 * already saved by the time this runs, and a page that is genuinely waiting
 * for review should not fail to be waiting because LINE was down.
 */
export async function notifyReview(message: string): Promise<boolean> {
  if (!TARGET || !linePushConfigured()) return false;
  try {
    return await pushLineText(TARGET, message.slice(0, 900));
  } catch (err) {
    console.error("[pages/review] could not send the LINE notice", err);
    return false;
  }
}

/** The wording for each kind of notice, in one place so the four of them
 *  stay in the same voice. */
export const reviewMessage = {
  requested: (title: string, who: string, note: string, link: string) =>
    `ขออนุมัติเผยแพร่หน้า "${title}"\nโดย ${who}` +
    (note ? `\nหมายเหตุ: ${note}` : "") +
    `\n\nเปิดดูและอนุมัติ:\n${link}`,
  approved: (title: string, who: string, link: string) =>
    `อนุมัติและเผยแพร่หน้า "${title}" แล้ว\nโดย ${who}\n\n${link}`,
  changes: (title: string, who: string, reply: string, link: string) =>
    `ขอให้แก้หน้า "${title}" ก่อนเผยแพร่\nโดย ${who}` +
    (reply ? `\nสิ่งที่ต้องแก้: ${reply}` : "") +
    `\n\n${link}`,
};
