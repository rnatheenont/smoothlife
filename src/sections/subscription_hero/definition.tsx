import { Fragment } from "react";
import { Repeat } from "lucide-react";
import { z } from "zod";
import { subscriptionPlans } from "@/data/subscriptions";
import { CONTENT_ICON_KEYS, contentIcon } from "../shared/content-icons";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The subscription page's banner: dark, full-bleed, two soft lights behind it.
//
// Not page_header, which the plan reached for first: that one is a line of
// type on the page's own background and this is a lit room. Reproducing this
// with page_header would have meant a "dark banner" mode on the block every
// content page uses, which is how a section library turns into one section
// with thirty switches.
//
// The headline carries {discount}, replaced with the best plan's percentage.
// It has to be a token rather than a number somebody types: the plans live in
// data/subscriptions.ts, and a headline promising 15% beside a plan table
// offering 20% is worse than no headline.

const schema = z.object({
  badge: z.string().max(60).default(""),
  /** A line break becomes a <br> that only breaks from md up, as the page
   *  has always done — on a phone the headline wraps where it wants to. */
  title: z.string().max(200).default(""),
  intro: z.string().max(400).default(""),
  perks: z
    .array(z.object({ icon: z.string().default(""), label: z.string().max(60).default("") }))
    .max(4)
    .default([]),
});

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const maxDiscount = Math.max(...subscriptionPlans.map((p) => p.discountPct));
  const title = settings.title.replace(/\{discount\}/g, String(maxDiscount));
  const lines = title.split("\n");
  const perks = settings.perks.filter((p) => p.label);

  return (
    <section className="relative overflow-hidden bg-brand-ink text-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-teal/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand-sky/25 blur-3xl" />
      <div className="container-page relative py-12 text-center md:py-20">
        {settings.badge && (
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <Repeat size={13} /> {settings.badge}
          </span>
        )}
        {title && (
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-5xl md:leading-none">
            {/* A space *before* the break, and a Fragment rather than a
                span: below md the break is hidden, and without the space the
                two lines run into each other as one word. The hand-written
                headline had that space too — it is the whole reason the line
                reads on a phone. */}
            {lines.map((line, i) => (
              <Fragment key={i}>
                {line}
                {i < lines.length - 1 && (
                  <>
                    {" "}
                    <br className="hidden md:block" />
                  </>
                )}
              </Fragment>
            ))}
          </h1>
        )}
        {settings.intro && <p className="mx-auto mt-4 max-w-lg text-white/80">{settings.intro}</p>}
        {perks.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-white/85 md:gap-6 md:text-sm">
            {perks.map((perk, i) => {
              const Icon = contentIcon(perk.icon);
              return (
                <span key={i} className="flex items-center gap-1.5">
                  {Icon && <Icon size={14} />} {perk.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export const subscriptionHero: SectionDefinition<typeof schema> = {
  type: "subscription_hero",
  version: 1,
  label: "แบนเนอร์หน้าสมัครสมาชิก",
  description: "แถบเข้มเต็มความกว้าง พร้อมป้าย หัวข้อ คำโปรย และข้อดีสั้นๆ",
  category: "hero",
  schema,
  defaults: {
    badge: "Smoothlife Subscription",
    title: "ดูแลตัวเองต่อเนื่อง\nไม่ต้องสั่งซ้ำ ประหยัดสูงสุด {discount}%",
    intro: "เลือกสินค้าที่ใช้ประจำ กำหนดรอบส่งของคุณเอง 3 / 6 หรือ 12 เดือน ยิ่งเลือกรอบยาว ยิ่งได้ส่วนลดมากขึ้น",
    perks: [
      { icon: "truck", label: "ส่งฟรีทุกรอบ" },
      { icon: "clock", label: "เลือกรอบส่ง 3 / 6 / 12 เดือน" },
      { icon: "shield", label: "ของแท้ 100% มีอย." },
    ],
  },
  fields: [
    { key: "badge", type: "text", label: "ป้ายบนสุด" },
    { key: "title", type: "textarea", label: "หัวข้อ", help: "ใส่ {discount} แทนตัวเลขส่วนลดสูงสุด · ขึ้นบรรทัดใหม่จะตัดบรรทัดบนจอใหญ่" },
    { key: "intro", type: "textarea", label: "คำโปรย" },
    {
      key: "perks",
      type: "list",
      label: "ข้อดีสั้นๆ",
      item: "ข้อดี",
      max: 4,
      columns: [
        { key: "icon", label: "เครื่องหมาย", half: true, placeholder: "truck" },
        { key: "label", label: "ข้อความ", half: true },
      ],
    },
  ],
  enabledOn: ["system"],
  maxPerPage: 1,
  isLcpCandidate: true,
  Component,
};
