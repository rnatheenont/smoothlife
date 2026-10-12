import { supabaseConfigured, supabaseRest, supabaseRestCached } from "@/lib/supabase-server";
import { migrateDoc, type PageDoc } from "./doc";
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

/** Every published page of a kind, for the sitemap and the admin list. */
export async function publishedPages(kind: PageKind): Promise<{ slug: string; title: string }[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseRest<{ slug: string; title: string }[]>(
      `pages?select=slug,title&kind=eq.${encodeURIComponent(kind)}&status=eq.published&order=slug&limit=200`
    );
  } catch (err) {
    console.error(`[pages] could not list published ${kind} pages`, err);
    return [];
  }
}
