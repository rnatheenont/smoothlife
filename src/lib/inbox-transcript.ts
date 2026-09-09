// Escalations used to paste the whole prior chat into the thread as one
// message. That stopped (see api/chat/escalate), but the ones already filed
// are still there — and they are long enough to push the customer's actual
// request off the screen and to fill every preview in the list with the same
// opening exchange.
//
// Recognised by the header the escalation wrote, so nothing a customer types
// can be mistaken for one.
export const TRANSCRIPT_HEADER = "— บทสนทนากับน้อง Smoothie ก่อนหน้านี้ —";

export function isTranscriptDump(content: string): boolean {
  return content.trimStart().startsWith(TRANSCRIPT_HEADER);
}
