import { cookies } from "next/headers";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { campaignPhaseAt, type CampaignPhase } from "@/lib/pages/doc";
import { migrateDoc } from "@/lib/pages/doc";
import { renderSections } from "@/lib/pages/render";
import { PHASE_ORDER } from "@/lib/pages/campaign";
import { campaignTimesOf } from "@/lib/pages/admin";
import { themeVars, type CampaignTheme } from "@/lib/pages/theme";
import { PAGE_KINDS } from "@/lib/pages/system-pages";
import type { PageRow } from "@/lib/pages/store";
import PreviewSelect from "@/components/admin/pages/PreviewSelect";

// The draft, drawn exactly the way the live page draws it.
//
// It lives outside /admin so the editor can put it in an iframe without the
// admin sidebar and header coming along — the point of a preview is to see
// the page, not the tool. Being outside /admin also means it is not covered
// by the proxy's gate, so it checks the admin cookie itself, right here. A
// draft is unpublished work; it should be no easier to read than the editor.
//
// isPreview: true, so a section that fails shows a red box explaining itself
// instead of silently vanishing. On the live page it vanishes, because a
// customer should not be shown our plumbing; here, a section that disappears
// while you are editing it is a bug nobody can report.
//
// ?profile=draft draws a brand page from the profile the team is editing
// rather than the one that is live, so "does this hero picture work" can be
// answered before the answer is on the site. The draft lives in a column
// nothing public reads, and this route is already behind the admin cookie.
//
// ?phase=teaser|live|extended|ended overrides the phase a campaign would be
// in right now. Without it a campaign built in October can only ever be
// previewed in its teaser phase, which is the one phase nobody is worried
// about — the questions worth answering before publishing are "what does
// the sale look like on the day" and "what does someone arriving a week
// late see".

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ตัวอย่างก่อนเผยแพร่",
  robots: { index: false, follow: false },
};

const KINDS = PAGE_KINDS;

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface-soft p-8 text-center">
      <p className="max-w-sm text-sm text-slate-600">{children}</p>
    </div>
  );
}

export default async function PagePreview(props: {
  params: Promise<{ kind: string; slug: string }>;
  searchParams: Promise<{ phase?: string; profile?: string }>;
}) {
  const { kind: rawKind, slug } = await props.params;
  const { phase: rawPhase, profile: rawProfile } = await props.searchParams;

  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return <Notice>ต้องเข้าสู่ระบบแอดมินก่อนจึงจะดูตัวอย่างได้</Notice>;
  if (!supabaseConfigured()) return <Notice>ยังเชื่อมต่อฐานข้อมูลไม่ได้</Notice>;

  const kind = KINDS.find((k) => k === rawKind);
  if (!kind) return <Notice>ไม่รู้จักประเภทเพจนี้</Notice>;

  const [page] = await supabaseRest<PageRow[]>(
    `pages?select=*&kind=eq.${pgValue(kind)}&slug=eq.${pgValue(slug)}&limit=1`
  );
  if (!page) return <Notice>ยังไม่มีเพจนี้ — เปิดในหน้าแก้ไขหนึ่งครั้งเพื่อสร้าง</Notice>;

  const doc = migrateDoc(page.draft_doc);
  if (doc.sections.length === 0) return <Notice>ร่างนี้ยังไม่มี section เลย</Notice>;

  const now = new Date();
  // Only a campaign has phases, and only a phase this system knows about is
  // honoured — an unrecognised value falls back to the real one rather than
  // showing a page that could never exist.
  const asked = PHASE_ORDER.find((candidate) => candidate === rawPhase);
  const phase: CampaignPhase | undefined =
    kind === "campaign" ? (asked ?? campaignPhaseAt(campaignTimesOf(page), now)) : undefined;

  const sections = await renderSections(doc, {
    kind,
    slug,
    now,
    phase,
    times: kind === "campaign" ? campaignTimesOf(page) : undefined,
    // Only a brand page has a profile to draft, and only when asked for.
    draftProfile: kind === "brand" && rawProfile === "draft",
    isPreview: true,
  });

  // Click-to-select lives in the frame, because the frame is the only thing
  // that knows where the sections are on screen.
  const picker = <PreviewSelect />;

  if (kind === "campaign") {
    // Wrapped exactly as /sale/[slug] wraps it, colours included. A preview
    // that renders in the site's own green while the campaign is pink is a
    // preview of something else.
    return (
      <main
        data-campaign={slug}
        data-phase={phase}
        className="campaign-page min-h-dvh"
        style={themeVars(page.campaign_theme as CampaignTheme | null)}
      >
        {sections}
        {picker}
      </main>
    );
  }

  // The same canvas the home page paints on, so what is in the frame is what
  // would be on the site.
  return (
    <div className="bg-[#FAFAF8]">
      {sections}
      {picker}
    </div>
  );
}
