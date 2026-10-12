import { z } from "zod";
import Link from "next/link";
import Countdown from "@/components/campaign/Countdown";
import { campaignsForBrand } from "@/lib/pages/store";
import { campaignPhaseAt } from "@/lib/pages/doc";
import { PHASE_LABEL } from "@/lib/pages/campaign";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// "This brand is in a sale right now" — on the brand's own page.
//
// The other half of the link a brand-day campaign needs: the campaign page
// sends people to the brand, and anyone who arrives at the brand page by any
// other route should not have to find out about the sale by accident.
//
// Which campaigns count is stated rather than inferred: a campaign names its
// brands (pages.campaign_brands, set in the campaign's own panel). The
// tempting alternative was to look inside the campaign's document for a brand
// row mentioning this brand, which would have tied the relationship to the
// layout — move that section out and the bar would vanish with no way to
// explain why.
//
// Out of season it draws nothing, so it can sit in the automatic brand
// template for every brand all year.

const schema = z.object({
  ctaLabel: z.string().max(30).default("ดูแคมเปญ"),
});

type Settings = z.output<typeof schema>;
type Data = { slug: string; title: string; label: string; countdownTo: string | null } | null;

async function load(_settings: Settings, ctx: { slug: string; now: Date }): Promise<Data> {
  const campaigns = await campaignsForBrand(ctx.slug);

  for (const campaign of campaigns) {
    const phase = campaignPhaseAt(campaign.times, ctx.now);
    if (phase === "ended") continue;
    const countdownTo =
      phase === "teaser"
        ? (campaign.times.liveAt ?? null)
        : (campaign.times.extendedAt ?? campaign.times.endsAt ?? null);
    return { slug: campaign.slug, title: campaign.title, label: PHASE_LABEL[phase], countdownTo };
  }
  return null;
}

function Component({ settings, data }: SectionProps<Settings, Data>) {
  if (!data) return null;

  return (
    <section className="container-page mt-6">
      <div className="flex flex-col gap-3 rounded-xl2 border border-surface-line bg-brand-gradient-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-brand-800">{data.label}</p>
          <p className="truncate text-sm font-bold text-brand-ink">{data.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* The phase that changes belongs to the campaign page, not this
              one, so there is nothing here for the server to re-decide. */}
          {data.countdownTo && <Countdown to={data.countdownTo} size="sm" onZeroRefresh={false} />}
          <Link
            href={`/sale/${data.slug}`}
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white"
          >
            {settings.ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

export const brandCampaignBar: SectionDefinition<typeof schema> = {
  type: "brand_campaign_bar",
  version: 1,
  label: "แถบแคมเปญของแบรนด์",
  description: "ขึ้นเองเมื่อแบรนด์นี้อยู่ในแคมเปญที่กำลังจัด · ไม่มีแคมเปญก็ไม่แสดงอะไร",
  category: "brand",
  schema,
  defaults: { ctaLabel: "ดูแคมเปญ" },
  fields: [{ key: "ctaLabel", type: "text", label: "ข้อความบนปุ่ม" }],
  enabledOn: ["brand"],
  maxPerPage: 1,
  load,
  Component,
};
