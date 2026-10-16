import { z } from "zod";
import Link from "next/link";
import Countdown from "@/components/campaign/Countdown";
import { getMessages } from "@/lib/i18n/messages";
import { takeoverCampaigns } from "@/lib/pages/store";
import { campaignPhaseAt } from "@/lib/pages/doc";
import { PHASE_LABEL } from "@/lib/pages/campaign";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The home page's slot for whichever campaign is on.
//
// Placed once and then left alone — that is the entire point. The alternative
// is editing the home page at the start and end of every campaign, which
// means the home page is edited under time pressure four times a year and
// still shows last month's sale on the morning after it ended.
//
// It finds its own campaign: published, takeover_home set, and currently in a
// phase that is not "ended". Nothing matching means the section renders
// nothing at all, which is why it is safe to leave in place out of season.

const schema = z.object({
  style: z.enum(["banner", "bar"]).default("banner"),
  ctaLabel: z.string().max(30).default("ดูดีลทั้งหมด"),
});

type Settings = z.output<typeof schema>;
type Data = { slug: string; title: string; phase: string; label: string; countdownTo: string | null } | null;

async function load(_settings: Settings, ctx: { now: Date }): Promise<Data> {
  const campaigns = await takeoverCampaigns();

  for (const campaign of campaigns) {
    const phase = campaignPhaseAt(campaign.times, ctx.now);
    if (phase === "ended") continue;

    // Before the sale, count towards it; during it, count towards the end.
    // A visitor on the home page is being told either "soon" or "hurry", and
    // which of those it is is not a decision the admin should have to make
    // twice a campaign.
    const countdownTo =
      phase === "teaser"
        ? (campaign.times.liveAt ?? null)
        : (campaign.times.extendedAt ?? campaign.times.endsAt ?? null);

    return { slug: campaign.slug, title: campaign.title, phase, label: PHASE_LABEL[phase], countdownTo };
  }
  // The first match wins and they are ordered by start date, so two
  // overlapping campaigns show the one that started first rather than
  // whichever the database felt like returning.
  return null;
}

function Component({ settings, data, ctx }: SectionProps<Settings, Data>) {
  if (!data) return null;
  const href = `/sale/${data.slug}`;

  if (settings.style === "bar") {
    return (
      <section className="container-page py-2">
        <Link
          href={href}
          className="flex items-center justify-between gap-3 rounded-xl2 px-4 py-3"
          style={{ backgroundColor: "var(--cp-accent, var(--color-brand-800))", color: "var(--cp-on-accent, #fff)" }}
        >
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {data.label} · {data.title}
          </span>
          <span className="shrink-0 text-[13px] font-semibold underline">{settings.ctaLabel}</span>
        </Link>
      </section>
    );
  }

  return (
    <section className="container-page py-4">
      <div
        className="flex flex-col gap-3 rounded-xl2 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6"
        style={{ backgroundColor: "var(--cp-accent, var(--color-brand-800))", color: "var(--cp-on-accent, #fff)" }}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-semibold opacity-90">{data.label}</p>
          <h2 className="mt-0.5 text-lg font-bold leading-tight md:text-xl">{data.title}</h2>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          {/* The clock here is counting towards a phase change on another
              page, so refreshing this one at zero would not change what it
              says — the home page is re-rendered by the scheduler instead. */}
          {data.countdownTo && <Countdown to={data.countdownTo} words={getMessages(ctx.locale).countdown} size="sm" onZeroRefresh={false} />}
          <Link
            href={href}
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-white/95 px-5 text-sm font-semibold text-brand-ink"
          >
            {settings.ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

export const campaignSlot: SectionDefinition<typeof schema> = {
  type: "campaign_slot",
  version: 1,
  label: "ช่องแคมเปญ (หน้าแรก)",
  description: "แสดงแคมเปญที่กำลังจัดอยู่เอง · วางครั้งเดียว ใช้ได้ทุกแคมเปญ · ไม่มีแคมเปญก็ไม่แสดงอะไร",
  category: "promo",
  schema,
  defaults: { style: "banner", ctaLabel: "ดูดีลทั้งหมด" },
  fields: [
    {
      key: "style",
      type: "select",
      label: "หน้าตา",
      options: [["banner", "กล่องใหญ่"], ["bar", "แถบบาง"]],
    },
    { key: "ctaLabel", type: "text", label: "ข้อความลิงก์" },
  ],
  enabledOn: ["home", "page"],
  maxPerPage: 2,
  load,
  Component,
};
