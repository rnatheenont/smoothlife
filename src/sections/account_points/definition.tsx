import { z } from "zod";
import PointsView from "@/app/account/points/PointsView";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The points page's own app: the balance, the tier, the history, and what the
// points can be exchanged for.
//
// Locked and settingless for the same reason as the referral page — it is all
// this customer's own numbers. The room around it is the point: "เดือนนี้
// แลก 500 คะแนนได้ของแถมเพิ่ม" is a sentence somebody should be able to put
// above the table without waiting for a deploy.

const schema = z.object({});

function Component({}: SectionProps<z.output<typeof schema>>) {
  return <PointsView />;
}

export const accountPoints: SectionDefinition<typeof schema> = {
  type: "account_points",
  version: 1,
  label: "หน้าคะแนนสะสม",
  description: "คะแนน ระดับสมาชิก ประวัติ และของที่แลกได้ — ล็อก ข้อมูลเป็นของลูกค้าคนนั้น",
  category: "content",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  Component,
};
