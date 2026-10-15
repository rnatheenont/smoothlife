import { z } from "zod";
import SubscriptionTermsInfo from "@/components/SubscriptionTermsInfo";
import { subscriptionBillingConfigured } from "@/lib/2c2p";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// What somebody is agreeing to when they subscribe.
//
// Locked and settingless, and this is the one block on the page that should
// never have been editable: it says how the recurring charge works and what
// happens when billing is not switched on yet. Words that describe a payment
// arrangement belong with the code that makes the charge.

const schema = z.object({});

type Data = { billingEnabled: boolean };

async function load(): Promise<Data> {
  return { billingEnabled: subscriptionBillingConfigured() };
}

function Component({ data }: SectionProps<z.output<typeof schema>, Data>) {
  return <SubscriptionTermsInfo billingEnabled={data?.billingEnabled ?? false} />;
}

export const subscriptionTerms: SectionDefinition<typeof schema> = {
  type: "subscription_terms",
  version: 1,
  label: "เงื่อนไขการสมัครรายรอบ",
  description: "คำอธิบายว่าการตัดเงินแต่ละรอบทำงานอย่างไร — ล็อก แก้ที่โค้ดเท่านั้น",
  category: "content",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};
