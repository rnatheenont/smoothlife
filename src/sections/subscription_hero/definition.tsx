import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Repeat } from "lucide-react";
import { z } from "zod";
import { subscriptionPlans } from "@/data/subscriptions";
import { subscriptionProducts } from "@/lib/subscription-catalogue";
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
// Two columns from md up: what you get on the left, what you would be
// subscribing to on the right. It used to be a tall column of centred text
// with nothing to press — a banner that asks for a subscription and then
// offers no way to start one. Every subscription banner worth copying pairs
// the saving with a button and shows the product beside it:
//   https://mobbin.com/sites/sections/941e6f2d-ba28-49d3-9f53-4b974d3d92bb
//   https://mobbin.com/sites/sections/7a4565d8-0baf-4fe8-a8af-47e60dac245c
//   https://mobbin.com/sites/sections/d23ad203-be59-4a49-9ed3-38962a384fe9
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
  /** The two ways to subscribe, as the two buttons. Both point at anchors
   *  further down this same page by default — the banner's job is to get
   *  somebody to the first price, not to a different URL. */
  ctaLabel: z.string().max(40).default(""),
  ctaHref: z.string().max(200).default(""),
  ctaSecondaryLabel: z.string().max(40).default(""),
  ctaSecondaryHref: z.string().max(200).default(""),
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
  // Four real products, the same ones the picker below offers. A stock photo
  // of a cardboard box would say nothing a shopper here does not know.
  const shots = subscriptionProducts.slice(0, 4);

  return (
    <section className="relative overflow-hidden bg-brand-ink text-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-teal/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand-sky/25 blur-3xl" />
      <div className="container-page relative grid items-center gap-8 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:gap-12 md:py-14">
        <div className="text-center md:text-left">
          {settings.badge && (
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <Repeat size={13} /> {settings.badge}
            </span>
          )}
          {title && (
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-[2.75rem] md:leading-[1.15]">
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
          {settings.intro && (
            <p className="mx-auto mt-4 max-w-lg text-white/80 md:mx-0">{settings.intro}</p>
          )}

          {(settings.ctaLabel || settings.ctaSecondaryLabel) && (
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center md:justify-start">
              {settings.ctaLabel && settings.ctaHref && (
                <Link
                  href={settings.ctaHref}
                  className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-white px-6 font-bold text-brand-ink transition hover:bg-white/90"
                >
                  {settings.ctaLabel} <ArrowRight size={16} />
                </Link>
              )}
              {settings.ctaSecondaryLabel && settings.ctaSecondaryHref && (
                <Link
                  href={settings.ctaSecondaryHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-6 font-semibold text-white transition hover:bg-white/10"
                >
                  {settings.ctaSecondaryLabel}
                </Link>
              )}
            </div>
          )}

          {perks.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-white/85 md:justify-start md:text-[13px]">
              {perks.map((perk, i) => {
                const Icon = contentIcon(perk.icon);
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"
                  >
                    {Icon && <Icon size={14} className="shrink-0 text-brand-teal" />} {perk.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {shots.length === 4 && (
          <div className="relative mx-auto w-full max-w-xs md:max-w-none">
            <div className="grid grid-cols-4 gap-2 rounded-feature md:grid-cols-2 bg-white/10 p-2 backdrop-blur-sm">
              {shots.map((p, i) => (
                <div key={p.slug} className="relative aspect-square overflow-hidden rounded-xl2 bg-white">
                  <Image
                    src={p.image}
                    alt=""
                    fill
                    sizes="(max-width:768px) 22vw, 160px"
                    className="object-cover"
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-gradient px-3.5 py-1.5 text-xs font-bold text-white shadow-card">
              ประหยัดสูงสุด {maxDiscount}%
            </span>
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
  description: "แถบเข้มเต็มความกว้าง พร้อมป้าย หัวข้อ คำโปรย ปุ่ม และข้อดีสั้นๆ",
  category: "hero",
  schema,
  defaults: {
    badge: "Smoothlife Subscription",
    title: "ดูแลตัวเองต่อเนื่อง\nไม่ต้องสั่งซ้ำ ประหยัดสูงสุด {discount}%",
    intro: "เลือกสินค้าที่ใช้ประจำ กำหนดรอบส่งของคุณเอง 3 / 6 หรือ 12 เดือน ยิ่งเลือกรอบยาว ยิ่งได้ส่วนลดมากขึ้น",
    ctaLabel: "เลือกชุดสมัครสมาชิก",
    ctaHref: "#subscription-sets",
    ctaSecondaryLabel: "เลือกสินค้าเอง",
    ctaSecondaryHref: "#subscription-picker",
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
    { key: "ctaLabel", type: "text", label: "ปุ่มหลัก" },
    { key: "ctaHref", type: "text", label: "ลิงก์ปุ่มหลัก", placeholder: "#subscription-sets" },
    { key: "ctaSecondaryLabel", type: "text", label: "ปุ่มรอง" },
    { key: "ctaSecondaryHref", type: "text", label: "ลิงก์ปุ่มรอง", placeholder: "#subscription-picker" },
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
