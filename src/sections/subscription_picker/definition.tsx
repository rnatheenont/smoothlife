import { z } from "zod";
import SubscriptionPicker from "@/components/SubscriptionPicker";
import { subscriptionPlans } from "@/data/subscriptions";
import { subscriptionProducts } from "@/lib/subscription-catalogue";
import { subscriptionBillingConfigured } from "@/lib/2c2p";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Subscribing to one product rather than a set.
//
// Locked: the plans, the products that may be subscribed to, and whether
// billing is switched on at all are the arrangement, not the copy. The
// heading above it is the copy.
//
// `?plan=6` preselects a cycle, which is what the emails link to — read from
// the page's query string rather than looked up here, because a section
// cannot reach for it on the server.

const schema = z.object({
  heading: z.string().max(120).default(""),
  intro: z.string().max(300).default(""),
});

type Data = { defaultMonths: number | undefined; billingEnabled: boolean };

async function load(
  _settings: z.output<typeof schema>,
  ctx: { query?: Record<string, string | undefined> }
): Promise<Data> {
  return {
    defaultMonths: Number(ctx.query?.plan) || undefined,
    billingEnabled: subscriptionBillingConfigured(),
  };
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data>) {
  return (
    <section id="subscription-picker" className="container-page scroll-mt-24 border-t border-slate-100 py-10 md:py-14">
      {settings.heading && (
        <h2 className="mb-1 text-xl font-extrabold text-brand-ink md:text-2xl">{settings.heading}</h2>
      )}
      {settings.intro && <p className="mb-6 text-sm text-slate-500">{settings.intro}</p>}
      <SubscriptionPicker
        plans={subscriptionPlans}
        products={subscriptionProducts}
        subscriptionBillingEnabled={data?.billingEnabled ?? false}
        defaultMonths={data?.defaultMonths}
      />
    </section>
  );
}

export const subscriptionPickerSection: SectionDefinition<typeof schema> = {
  type: "subscription_picker",
  version: 1,
  label: "เลือกสินค้าเองรายรอบ",
  description: "ตัวเลือกสมัครสินค้าชิ้นเดียวตามรอบส่ง — ล็อก แก้ได้แค่หัวข้อ",
  category: "product",
  schema,
  defaults: {
    heading: "หรือเลือกสินค้าเอง",
    intro: "อยากได้แค่สินค้าชิ้นเดียวแบบสมัครรายรอบ เลือกได้จากที่นี่",
  },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อ" },
    { key: "intro", type: "textarea", label: "คำโปรย" },
  ],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};
