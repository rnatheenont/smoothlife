import { z } from "zod";
import ReferralView from "@/app/account/referral/ReferralView";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The referral page's own app: the share link, who has clicked it, and what
// each referral is worth so far.
//
// Locked and settingless — every number on it comes from this customer's own
// referrals. What the document around it is for is a line of copy: a push
// month, a doubled reward, a deadline.

const schema = z.object({});

function Component({}: SectionProps<z.output<typeof schema>>) {
  return <ReferralView />;
}

export const accountReferral: SectionDefinition<typeof schema> = {
  type: "account_referral",
  version: 1,
  label: "หน้าชวนเพื่อน",
  description: "ลิงก์ชวนเพื่อนและสถานะของแต่ละคน — ล็อก ข้อมูลเป็นของลูกค้าคนนั้น",
  category: "content",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  Component,
};
