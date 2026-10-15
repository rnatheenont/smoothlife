import { PAGES_WAVE4_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import ReferralView from "./ReferralView";

/**
 * The page, from its document when wave 4 is on and from ReferralView when it
 * is not. Both draw the same view; what the document adds is room for a line
 * of copy above or below it — "ชวนเพื่อนเดือนนี้ได้คูปองเพิ่ม" during a push
 * — without a deploy.
 */
export default function ReferralPage() {
  if (PAGES_WAVE4_ENABLED) return <SystemPageBody pageKey="account-referral" />;
  return <ReferralView />;
}
