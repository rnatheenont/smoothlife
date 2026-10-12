import { supabaseConfigured, supabaseRest, supabaseRestCached } from "@/lib/supabase-server";
import { migrateDoc, type PageDoc } from "./doc";
import type { CampaignTimes } from "./campaign";
import type { CampaignTheme } from "./theme";
import type { PageKind } from "./types";

// Reading a published page out of Supabase, and never failing to return one.
//
// Everything here answers the same question — "what should this page look
// like right now" — and the answer is allowed to be "whatever the code says",
// because a home page that is briefly out of date is a different thing from a
// home page that is blank.

export type PageRow = {
  id: string;
  kind: PageKind;
  slug: string;
  title: string;
  status: "draft" | "scheduled" | "published" | "ended" | "archived";
  draft_doc: unknown;
  draft_version: number;
  draft_updated_by: string | null;
  draft_updated_at: string;
  published_revision_id: string | null;
  publish_at: string | null;
  unpublish_at: string | null;
  campaign_teaser_at: string | null;
  campaign_live_at: string | null;
  campaign_extended_at: string | null;
  campaign_ends_at: string | null;
  takeover_home: boolean;
  campaign_theme: unknown;
};

export function pageTag(kind: PageKind, slug: string) {
  return `page:${kind}:${slug}`;
}

/**
 * Why the two reads are cached differently.
 *
 * The pointer — which revision a page is currently publishing — is read
 * fresh every time. It is one indexed lookup on a tiny table, and caching it
 * caused a bug worth remembering: a page that does not exist yet answers
 * "no row", that answer got cached for thirty minutes, and the first publish
 * of a page was invisible for half an hour afterwards. A cache that
 * remembers absence is a cache that hides creation.
 *
 * The document is cached hard, because page_revisions is append-only — there
 * is a trigger on the table that refuses UPDATE. A revision id always names
 * the same bytes, so this entry can never be wrong, only unused.
 */
const REVISION_TTL = 86_400;

/**
 * The lists that feed the sitemap are cached, and they have to be.
 *
 * /sitemap.xml is prerendered at build time, and an uncached read inside a
 * prerender throws "Dynamic server usage" — which these functions caught and
 * turned into an empty list, so the sitemap quietly contained no built pages
 * at all. The `pages` tag is cleared on every publish and rollback, so this
 * cache cannot go stale in the direction that matters: a page that just went
 * live is in the next sitemap, not in an hour's time.
 */
const SITEMAP_TTL = 3600;

/**
 * How long a campaign's own row may be remembered.
 *
 * Short, because this row carries the four dates that decide the phase and
 * the three colours of the theme — everything that changes about a campaign
 * without the document changing. The scheduler clears the tag the minute a
 * phase turns over, so this number is only the backstop for the minute the
 * cron misses, not the mechanism.
 */
const CAMPAIGN_POINTER_TTL = 300;

export async function publishedDoc(kind: PageKind, slug: string): Promise<PageDoc | null> {
  if (!supabaseConfigured()) {
    console.info(`[pages] Supabase is not configured — ${kind}/${slug} uses the built-in page`);
    return null;
  }

  try {
    // Two reads rather than a join: PostgREST cannot compare a column in one
    // table against a column in another, which is what "the revision this
    // page points at" is.
    const pages = await supabaseRest<Pick<PageRow, "status" | "published_revision_id">[]>(
      `pages?select=status,published_revision_id` +
        `&kind=eq.${encodeURIComponent(kind)}&slug=eq.${encodeURIComponent(slug)}&limit=1`
    );

    const page = pages[0];
    if (!page) {
      console.info(`[pages] no ${kind}/${slug} row yet — using the built-in page`);
      return null;
    }
    if (page.status !== "published" || !page.published_revision_id) {
      console.info(
        `[pages] ${kind}/${slug} is "${page.status}" with revision ${page.published_revision_id ?? "none"} — using the built-in page`
      );
      return null;
    }

    const revisions = await supabaseRestCached<{ doc: unknown }[]>(
      `page_revisions?select=doc&id=eq.${encodeURIComponent(page.published_revision_id)}&limit=1`,
      { revalidate: REVISION_TTL, tags: [pageTag(kind, slug), "pages"] }
    );
    const revision = revisions[0];
    if (!revision) {
      console.error(`[pages] ${kind}/${slug} points at a revision that is not there — using the built-in page`);
      return null;
    }

    const doc = migrateDoc(revision.doc);
    if (doc.sections.length === 0) {
      console.error(`[pages] published document for ${kind}/${slug} has no usable sections — using the built-in page`);
      return null;
    }
    return doc;
  } catch (err) {
    console.error(`[pages] could not read ${kind}/${slug}, using the built-in page`, err);
    return null;
  }
}

/**
 * A campaign page: its document and the four dates that decide its phase.
 *
 * One read rather than publishedDoc plus a second query, because the phase
 * has to be decided from the same row the document came from. Reading them
 * separately leaves a window — small, but exactly one minute wide every time
 * a campaign goes live — where the page renders yesterday's document against
 * today's phase.
 *
 * A campaign in its "ended" phase still returns everything. Its status is
 * still "published"; what ended is the sale, not the page. The plan is
 * explicit that a finished campaign shows "แคมเปญจบแล้ว" and what is next,
 * because the people arriving on it are arriving from an advert that is
 * still running, and a 404 tells them nothing.
 */
export async function publishedCampaign(slug: string): Promise<{
  doc: PageDoc;
  title: string;
  times: CampaignTimes;
  theme: CampaignTheme | null;
} | null> {
  if (!supabaseConfigured()) return null;

  try {
    // Cached, unlike the pointer read for ordinary pages, because a campaign
    // page is the one that gets the traffic: on a 11.11 morning this is the
    // busiest URL on the site, and a per-request round trip to Supabase for
    // every visitor is a bill and a latency floor for nothing.
    //
    // Tagged with this campaign's own tag, which is what makes it safe to
    // cache a "no row yet" answer — publish clears exactly this tag, so the
    // first publish of a new campaign appears at once rather than whenever
    // the entry happens to expire. That bug (a cached absence hiding a
    // creation) cost half an hour of confusion on the home page; the fix is
    // the tag, not a shorter life.
    const [page] = await supabaseRestCached<
      (Pick<PageRow, "status" | "published_revision_id" | "title"> & {
        campaign_teaser_at: string | null;
        campaign_live_at: string | null;
        campaign_extended_at: string | null;
        campaign_ends_at: string | null;
        campaign_theme: unknown;
      })[]
    >(
      `pages?select=status,published_revision_id,title,campaign_teaser_at,campaign_live_at,` +
        `campaign_extended_at,campaign_ends_at,campaign_theme` +
        `&kind=eq.campaign&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      { revalidate: CAMPAIGN_POINTER_TTL, tags: [pageTag("campaign", slug), "pages"] }
    );

    if (!page || page.status !== "published" || !page.published_revision_id) return null;

    const [revision] = await supabaseRestCached<{ doc: unknown }[]>(
      `page_revisions?select=doc&id=eq.${encodeURIComponent(page.published_revision_id)}&limit=1`,
      { revalidate: REVISION_TTL, tags: [pageTag("campaign", slug), "pages"] }
    );
    if (!revision) {
      console.error(`[pages] campaign ${slug} points at a revision that is not there`);
      return null;
    }

    const doc = migrateDoc(revision.doc);
    if (doc.sections.length === 0) return null;

    return {
      doc,
      title: page.title,
      times: {
        teaserAt: page.campaign_teaser_at,
        liveAt: page.campaign_live_at,
        extendedAt: page.campaign_extended_at,
        endsAt: page.campaign_ends_at,
      },
      theme: isTheme(page.campaign_theme) ? page.campaign_theme : null,
    };
  } catch (err) {
    console.error(`[pages] could not read campaign ${slug}`, err);
    return null;
  }
}

/** Only the three fields the theme has, and only if they are strings — a
 *  jsonb column can hold anything, including whatever shape it held two
 *  deploys ago. */
function isTheme(value: unknown): value is CampaignTheme {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (["accent", "background", "badgeText"] as const).every(
    (key) => t[key] === undefined || t[key] === null || typeof t[key] === "string"
  );
}

/** Campaigns that are on right now and asked to appear on the home page.
 *  Read by the campaign_slot section, which the team places once and then
 *  never has to touch again. */
export async function takeoverCampaigns(): Promise<
  { slug: string; title: string; times: CampaignTimes; theme: CampaignTheme | null }[]
> {
  if (!supabaseConfigured()) return [];
  try {
    const rows = await supabaseRest<
      {
        slug: string;
        title: string;
        campaign_teaser_at: string | null;
        campaign_live_at: string | null;
        campaign_extended_at: string | null;
        campaign_ends_at: string | null;
        campaign_theme: unknown;
      }[]
    >(
      `pages?select=slug,title,campaign_teaser_at,campaign_live_at,campaign_extended_at,campaign_ends_at,campaign_theme` +
        `&kind=eq.campaign&status=eq.published&takeover_home=is.true&order=campaign_live_at&limit=5`
    );
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      times: {
        teaserAt: row.campaign_teaser_at,
        liveAt: row.campaign_live_at,
        extendedAt: row.campaign_extended_at,
        endsAt: row.campaign_ends_at,
      },
      theme: isTheme(row.campaign_theme) ? row.campaign_theme : null,
    }));
  } catch (err) {
    console.error("[pages] could not list takeover campaigns", err);
    return [];
  }
}

/** A page's admin title, for the browser tab and the sitemap. Null when the
 *  page is not there or is not published — the caller shows a 404 rather
 *  than a shell at a URL somebody shared. */
export async function pageTitleOf(kind: PageKind, slug: string): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  try {
    const [row] = await supabaseRest<{ title: string; status: PageRow["status"] }[]>(
      `pages?select=title,status&kind=eq.${encodeURIComponent(kind)}&slug=eq.${encodeURIComponent(slug)}&limit=1`
    );
    return row && row.status === "published" ? row.title : null;
  } catch {
    return null;
  }
}

/**
 * Campaigns that are worth telling Google about: published, and not over.
 *
 * A finished campaign is served with noindex (see app/sale/[slug]), and
 * listing a noindex URL in the sitemap is a contradiction — the same reason
 * the sitemap skips pack pages that canonicalise elsewhere. The page stays
 * up for the adverts still pointing at it; it just stops asking to be found.
 */
export async function indexableCampaigns(now = new Date()): Promise<{ slug: string }[]> {
  if (!supabaseConfigured()) return [];
  try {
    const rows = await supabaseRestCached<{ slug: string; campaign_ends_at: string | null }[]>(
      `pages?select=slug,campaign_ends_at&kind=eq.campaign&status=eq.published&order=slug&limit=200`,
      { revalidate: SITEMAP_TTL, tags: ["pages"] }
    );
    return rows
      .filter((row) => {
        if (!row.campaign_ends_at) return true;
        const ends = Date.parse(row.campaign_ends_at);
        return !Number.isFinite(ends) || ends > now.getTime();
      })
      .map(({ slug }) => ({ slug }));
  } catch (err) {
    console.error("[pages] could not list campaigns for the sitemap", err);
    return [];
  }
}

/** Every published page of a kind, for the sitemap. */
export async function publishedPages(kind: PageKind): Promise<{ slug: string; title: string }[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRestCached<{ slug: string; title: string }[]>(
      `pages?select=slug,title&kind=eq.${encodeURIComponent(kind)}&status=eq.published&order=slug&limit=200`,
      { revalidate: SITEMAP_TTL, tags: ["pages"] }
    );
  } catch (err) {
    console.error(`[pages] could not list published ${kind} pages`, err);
    return [];
  }
}
