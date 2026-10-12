import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { publishedCampaign } from "@/lib/pages/store";
import { renderSections } from "@/lib/pages/render";
import { campaignPhaseAt } from "@/lib/pages/doc";
import { PHASE_LABEL } from "@/lib/pages/campaign";
import { themeVars } from "@/lib/pages/theme";
import { ogImages, withSeoOverride } from "@/lib/seo-overrides";

// Campaign pages — /sale/11-11, /sale/payday.
//
// The slug is reused every year on purpose (plan §6.1): old adverts, old
// links and whatever Google has learned about /sale/11-11 all keep working,
// and next year's campaign is last year's page duplicated and edited.
//
// Three things decide what a visitor sees, and all three are decided here on
// the server:
//
//   1. the document — whatever revision is published
//   2. the phase — teaser / live / extended / ended, from the four dates
//   3. the theme — three CSS variables on this page's own wrapper
//
// The phase is server-side because the client's clock belongs to the client.
// A phone an hour fast would otherwise show the sale an hour early, prices
// and all, and the first thing anyone would hear about it is a complaint
// that the discount did not apply.
//
// The page is ISR, so the phase is baked into cached HTML; the scheduler
// revalidates this page's tag the minute a phase boundary passes, which is
// why the cron exists at all (api/cron/pages-schedule).

export const revalidate = 1800;

async function campaignOf(slug: string) {
  const campaign = await publishedCampaign(slug);
  if (!campaign) return null;
  const now = new Date();
  return { ...campaign, now, phase: campaignPhaseAt(campaign.times, now) };
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const campaign = await campaignOf(slug);
  if (!campaign) return { title: "ไม่พบแคมเปญนี้ | Smoothlife.com" };

  const seo = await withSeoOverride("campaign", slug, { title: `${campaign.title} | Smoothlife.com` });
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `/sale/${slug}` },
    openGraph: { title: seo.title, description: seo.description, ...ogImages(seo.image) },
    // A campaign that is over should stop competing in search with the one
    // that is running. The page stays up for the adverts still pointing at
    // it; it just stops asking to be found.
    robots: campaign.phase === "ended" ? { index: false, follow: true } : undefined,
  };
}

export default async function CampaignPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const campaign = await campaignOf(slug);
  if (!campaign) notFound();

  const sections = await renderSections(campaign.doc, {
    kind: "campaign",
    slug,
    now: campaign.now,
    phase: campaign.phase,
    times: campaign.times,
    isPreview: false,
  });

  // Every section can be hidden in a given phase, and in "ended" most of
  // them usually are. An empty campaign page is the one outcome this route
  // will not produce: someone is arriving here from a paid advert.
  const drawn = sections.filter(Boolean).length;

  return (
    <main
      data-campaign={slug}
      data-phase={campaign.phase}
      className="campaign-page min-h-[60vh]"
      style={themeVars(campaign.theme)}
    >
      {sections}
      {drawn === 0 && <CampaignOver title={campaign.title} phase={PHASE_LABEL[campaign.phase]} />}
    </main>
  );
}

/** Shown when the document has nothing to say in this phase. Deliberately
 *  plain and deliberately not a 404: it names the campaign the visitor came
 *  for, says where it stands, and offers the shop. */
function CampaignOver({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-lg rounded-xl2 border border-surface-line bg-white p-8 text-center">
        <p className="text-[13px] font-semibold text-brand-800">{phase}</p>
        <h1 className="mt-1 text-xl font-bold text-brand-ink">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-grey-600">
          แคมเปญนี้ยังไม่มีอะไรแสดงในช่วงนี้ — เลือกดูสินค้าและโปรโมชันที่กำลังมีอยู่ได้เลย
        </p>
        <Link
          href="/shop"
          className="mt-5 inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold"
          style={{ backgroundColor: "var(--cp-accent)", color: "var(--cp-on-accent)" }}
        >
          ดูสินค้าทั้งหมด
        </Link>
      </div>
    </div>
  );
}
