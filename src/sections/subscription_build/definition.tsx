import Link from "next/link";
import { ChevronRight, PackagePlus } from "lucide-react";
import { z } from "zod";
import { BUNDLE_DISCOUNT_PCT } from "@/data/subscriptions";
import { subscriptionBillingConfigured } from "@/lib/2c2p";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// "Build the set yourself."
//
// Only drawn when recurring billing is actually switched on, because the page
// it leads to cannot take a subscription otherwise — an invitation to a door
// that is locked is worse than no invitation. That check is the section's,
// not the admin's: it is a fact about the payment setup, not a decision.
//
// {bundleDiscount} is replaced with the real bundle discount, same reason as
// the headline's {discount}: a number typed by hand beside a discount the
// code applies is a promise the page cannot keep.

const schema = z.object({
  title: z.string().max(120).default(""),
  body: z.string().max(400).default(""),
  cta: z.string().max(60).default(""),
  href: z.string().default(""),
});

type Data = { billingEnabled: boolean };

async function load(): Promise<Data> {
  return { billingEnabled: subscriptionBillingConfigured() };
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data>) {
  if (!data?.billingEnabled) return null;
  if (!settings.title || !settings.href) return null;
  const body = settings.body.replace(/\{bundleDiscount\}/g, String(BUNDLE_DISCOUNT_PCT));

  return (
    <section className="container-page border-t border-slate-100 py-10 md:py-14">
      <Link
        href={settings.href}
        className="group flex flex-col items-center gap-5 rounded-xl2 border border-brand-teal/30 bg-brand-gradient-soft p-6 transition-shadow hover:shadow-cardHover md:flex-row md:p-8"
      >
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-gradient text-white">
          <PackagePlus size={26} />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-lg font-extrabold text-brand-ink md:text-xl">{settings.title}</h2>
          {body && <p className="mt-1 text-sm text-slate-500">{body}</p>}
        </div>
        {settings.cta && (
          <span className="flex shrink-0 items-center gap-1 font-semibold text-brand-800 transition-colors">
            {settings.cta} <ChevronRight size={16} />
          </span>
        )}
      </Link>
    </section>
  );
}

export const subscriptionBuild: SectionDefinition<typeof schema> = {
  type: "subscription_build",
  version: 1,
  label: "การ์ดจัดชุดเอง",
  description: "การ์ดชวนไปจัดชุดสินค้าเอง — ขึ้นเฉพาะเมื่อระบบตัดเงินรายรอบเปิดใช้งาน",
  category: "promo",
  schema,
  defaults: {
    title: "จัดชุดสินค้าเอง",
    body: "เลือกสินค้าที่ใช้ประจำมาจัดเป็นชุดของตัวเอง รับส่วนลดชุดพิเศษ -{bundleDiscount}% ซ้อนทับกับส่วนลดตามรอบที่เลือกได้อีก",
    cta: "เริ่มจัดชุด",
    href: "/subscription/build",
  },
  fields: [
    { key: "title", type: "text", label: "หัวข้อ" },
    { key: "body", type: "textarea", label: "คำอธิบาย", help: "ใส่ {bundleDiscount} แทนตัวเลขส่วนลดชุด" },
    { key: "cta", type: "text", label: "ข้อความชวนกด" },
    { key: "href", type: "text", label: "ลิงก์" },
  ],
  enabledOn: ["system"],
  maxPerPage: 1,
  load,
  Component,
};
