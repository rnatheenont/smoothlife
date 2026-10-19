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
  // Folded, and last. These are the terms of a thing — they cannot be read
  // before the thing exists, and as a wall of three cards above the first
  // price they only ever cost the shop the scroll. Every plan page worth
  // copying keeps the legal to one line near the buttons and the detail
  // within reach: https://mobbin.com/screens/694f3d02-5191-4e61-8fad-63fa19926960
  return (
    <section className="container-page border-t border-slate-100 py-10 md:py-14">
      <div className="mx-auto max-w-3xl">
        <SubscriptionTermsInfo billingEnabled={data?.billingEnabled ?? false} variant="compact" />
      </div>
    </section>
  );
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
