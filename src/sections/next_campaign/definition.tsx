import { z } from "zod";
import Link from "next/link";
import Countdown from "@/components/campaign/Countdown";
import { takeoverCampaigns } from "@/lib/pages/store";
import { campaignPhaseAt } from "@/lib/pages/doc";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// What to say to somebody who arrived after it was over.
//
// They are not lost — they clicked an advert that is still running, or a
// link a friend sent last week. The worst answer is a blank page, the second
// worst is "404". This one names what they missed and points at the next
// thing, which is the only useful move available.
//
// The next campaign is found the same way the home page's slot finds the
// current one, so nobody has to remember to come back and update this section
// after the sale: it reads whatever is published and set to take over, and
// skips the one it is sitting on.

const schema = z.object({
  heading: z.string().max(120).default("แคมเปญนี้จบแล้ว"),
  body: z.string().max(300).default(""),
  fallbackHref: z.string().default("/shop"),
  fallbackLabel: z.string().max(40).default("ดูสินค้าทั้งหมด"),
});

type Settings = z.output<typeof schema>;
type Data = { slug: string; title: string; startsAt: string | null } | null;

async function load(_settings: Settings, ctx: { now: Date; slug: string }): Promise<Data> {
  const campaigns = await takeoverCampaigns();
  for (const campaign of campaigns) {
    if (campaign.slug === ctx.slug) continue;
    if (campaignPhaseAt(campaign.times, ctx.now) === "ended") continue;
    return { slug: campaign.slug, title: campaign.title, startsAt: campaign.times.liveAt ?? null };
  }
  return null;
}

function Component({ settings, data }: SectionProps<Settings, Data>) {
  return (
    <section className="container-page py-12 md:py-16">
      <div className="mx-auto max-w-xl rounded-xl2 border border-surface-line bg-white p-7 text-center md:p-9">
        <h2 className="text-lg font-bold text-brand-ink md:text-xl">{settings.heading}</h2>
        {settings.body && <p className="mt-2 text-sm leading-relaxed text-grey-600">{settings.body}</p>}

        {data ? (
          <div className="mt-5 flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-brand-ink">ถัดไป: {data.title}</p>
            {/* Not refreshing at zero: this page's own phase does not change
                when the next campaign starts, so there is nothing for the
                server to decide again. */}
            {data.startsAt && <Countdown to={data.startsAt} label="เริ่มใน" size="sm" onZeroRefresh={false} />}
            <Link
              href={`/sale/${data.slug}`}
              className="inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold"
              style={{ backgroundColor: "var(--cp-accent)", color: "var(--cp-on-accent)" }}
            >
              ดูแคมเปญถัดไป
            </Link>
          </div>
        ) : (
          <Link
            href={settings.fallbackHref}
            className="mt-5 inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold"
            style={{ backgroundColor: "var(--cp-accent)", color: "var(--cp-on-accent)" }}
          >
            {settings.fallbackLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

export const nextCampaign: SectionDefinition<typeof schema> = {
  type: "next_campaign",
  version: 1,
  label: "แคมเปญถัดไป (ช่วงจบแล้ว)",
  description: "หาแคมเปญถัดไปเอง ถ้าไม่มีก็ลิงก์ไปหน้าสินค้า · ตั้งให้แสดงเฉพาะช่วง \"จบแล้ว\"",
  category: "promo",
  schema,
  defaults: {
    heading: "แคมเปญนี้จบแล้ว",
    body: "ขอบคุณที่ร่วมสนุกกับเรา — ดีลรอบหน้ากำลังมา",
    fallbackHref: "/shop",
    fallbackLabel: "ดูสินค้าทั้งหมด",
  },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อ" },
    { key: "body", type: "textarea", label: "ข้อความ" },
    { key: "fallbackHref", type: "text", label: "ลิงก์สำรอง (เมื่อไม่มีแคมเปญถัดไป)" },
    { key: "fallbackLabel", type: "text", label: "ข้อความลิงก์สำรอง" },
  ],
  enabledOn: ["campaign"],
  maxPerPage: 1,
  load,
  Component,
};
