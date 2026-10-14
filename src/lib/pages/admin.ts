import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { revalidateTag } from "next/cache";
import { migrateDoc, nextBoundaryAfter, SCHEMA_VERSION, type PageDoc } from "./doc";
import { defaultHomeDoc } from "./default-docs/home";
import { defaultBrandDoc } from "./default-docs/brand";
import { SYSTEM_DEFAULT_DOCS } from "./default-docs/system";
import { GLOBAL_DEFAULT_DOCS } from "./default-docs/global";
import { TEMPLATE_DEFAULT_DOCS } from "./default-docs/template";
import { getBrand } from "@/data/brands";
import { GLOBALS, SYSTEM_PAGES, TEMPLATES } from "./system-pages";
import { waveEnabled } from "@/lib/feature-flags";
import { nextPhaseBoundaryAfter, validateCampaignTimes, type CampaignTimes } from "./campaign";
import { checkTheme, type CampaignTheme } from "./theme";
import { pageTag, type PageRow } from "./store";
import { SECTION_REGISTRY } from "@/sections/registry";
import { campaignPhaseAt } from "./doc";
import type { AnySectionDefinition, PageKind, RenderCtx } from "./types";

// Everything the admin side does to a page: open it, save a draft, publish
// it, put a previous version back.
//
// The storefront never calls into here. It reads one published document and
// has no way to write anything, which is the point — nothing a visitor does
// can change what another visitor sees.

export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; reason: "conflict"; current: PageRow }
  | { ok: false; reason: "invalid"; issues: string[] };

/**
 * The page row, created from the built-in document if it is not there yet.
 *
 * Seeding happens the first time an admin opens the page rather than in a
 * migration, because the document is assembled from the section definitions
 * in the code — SQL cannot build it, and a copy pasted into a migration would
 * be a second source of truth that drifts the moment a default changes.
 */
/**
 * Documents that can be conjured out of nothing, by page kind.
 *
 * A seed exists where the built-in version of the page lives in the code, so
 * SQL could not have created it and a copy pasted into a migration would be a
 * second source of truth that drifts the moment a default changes. Every other
 * kind is created deliberately, through the create endpoint, with a title and
 * an address somebody chose.
 *
 * A seed returns null when it does not recognise the slug — "the home page"
 * is one page, not any page of kind home.
 */
const SEEDS: Partial<Record<PageKind, (slug: string) => { title: string; doc: PageDoc } | null>> = {
  home: (slug) => (slug === "home" ? { title: "หน้าแรก", doc: defaultHomeDoc() } : null),

  // A brand page starts as the page that brand already has, so "lay this one
  // out myself" begins from what is on the site rather than from a blank
  // screen. Only a brand the shop actually sells: the null is what stops
  // /admin/pages/brand/anything from conjuring a page for a slug nobody has
  // heard of.
  brand: (slug) => {
    const brand = getBrand(slug);
    return brand ? { title: `แบรนด์ ${brand.name}`, doc: defaultBrandDoc() } : null;
  },

  // The three kinds whose slugs are a closed list. Two conditions, and both
  // are the same answer — a 404 — because they mean the same thing from the
  // admin's side: there is nothing here to edit.
  //
  //   not in the registry → an address the shop does not serve
  //   wave not switched on → the page is still served by its own code, and a
  //     document edited now would be a draft of something nobody can see
  //
  // The second is what keeps a half-built wave out of the editor. It only
  // guards *creating* the row: a page that was opened while its wave was on
  // still opens after the wave is switched back off, which is what somebody
  // turning a wave off in a hurry needs — their work is still there.
  system: (slug) => {
    const page = SYSTEM_PAGES[slug];
    if (!page || !waveEnabled(page.wave)) return null;
    return { title: page.title, doc: defaultDocFor("system", slug) };
  },

  template: (slug) => {
    const template = TEMPLATES[slug];
    if (!template || !waveEnabled(template.wave)) return null;
    return { title: template.title, doc: defaultDocFor("template", slug) };
  },

  global: (slug) => {
    const doc = GLOBALS[slug];
    if (!doc || !waveEnabled(doc.wave)) return null;
    return { title: doc.title, doc: defaultDocFor("global", slug) };
  },
};

/**
 * The layout a page of the new kinds starts from.
 *
 * Each one gets a default document that renders the page as it looks today —
 * that is the whole method: move the page over without changing it, confirm
 * it is the same, and only then let anybody edit it. Those documents are
 * written per wave, so this map fills up as the waves are built, and a page
 * whose wave has been switched on without one would be a blank page where a
 * real one used to be.
 *
 * Which is why the fallback is an empty document rather than a guess: an
 * empty one cannot be published (validateForPublish refuses it), so the
 * mistake stops in the editor instead of on the shop.
 */
export const DEFAULT_DOCS: Record<string, () => PageDoc> = {
  // Wave 1's pages, keyed the way the editor addresses them. The rest are
  // filled in by E7 (waves 2–3), E8 (wave 4) and E3 (wave 5).
  ...Object.fromEntries(Object.entries(SYSTEM_DEFAULT_DOCS).map(([key, make]) => [`system/${key}`, make])),
  ...Object.fromEntries(Object.entries(GLOBAL_DEFAULT_DOCS).map(([key, make]) => [`global/${key}`, make])),
  ...Object.fromEntries(Object.entries(TEMPLATE_DEFAULT_DOCS).map(([key, make]) => [`template/${key}`, make])),
};

function defaultDocFor(kind: PageKind, slug: string): PageDoc {
  return DEFAULT_DOCS[`${kind}/${slug}`]?.() ?? { schemaVersion: SCHEMA_VERSION, sections: [] };
}

export async function openPage(kind: PageKind, slug: string, actor: string): Promise<PageRow | null> {
  if (!supabaseConfigured()) return null;

  const [existing] = await supabaseRest<PageRow[]>(
    `pages?select=*&kind=eq.${pgValue(kind)}&slug=eq.${pgValue(slug)}&limit=1`
  );
  if (existing) return existing;

  const seed = SEEDS[kind]?.(slug);
  if (!seed) return null;

  const [created] = await supabaseRest<PageRow[]>("pages", {
    method: "POST",
    body: JSON.stringify({
      kind,
      slug,
      title: seed.title,
      status: "draft",
      draft_doc: seed.doc,
      draft_updated_by: actor,
      created_by: actor,
    }),
  });
  return created ?? null;
}

/**
 * Problems that should stop a draft becoming the live page.
 *
 * `page` is optional because the editor asks this question about a document
 * before anything has been decided about dates or colours. When it is given,
 * the campaign rules apply too — and they are rules, not warnings: an accent
 * that cannot carry readable text, or four dates in an order that silently
 * skips a phase, are both things that cannot be seen by looking at the page
 * in the editor on the day it is built.
 */
export function validateForPublish(doc: PageDoc, page?: PageRow): string[] {
  const issues: string[] = [];
  const seen = new Map<string, number>();

  if (doc.sections.length === 0) issues.push("เพจนี้ยังไม่มี section เลย");

  if (page?.kind === "campaign") {
    issues.push(...validateCampaignTimes(campaignTimesOf(page)));
    issues.push(...checkTheme(page.campaign_theme as CampaignTheme | null));
    // A campaign with no dates at all is "live" for ever (see campaignPhaseAt),
    // which is almost never what somebody building a 11.11 page meant.
    if (!page.campaign_live_at && !page.campaign_teaser_at) {
      issues.push("ยังไม่ได้ตั้งวันเริ่มแคมเปญ — ถ้าไม่ตั้ง หน้านี้จะอยู่ในช่วง \"วันงาน\" ตลอดไป");
    }
  }

  for (const section of doc.sections) {
    const def = SECTION_REGISTRY[section.type];
    if (!def) {
      issues.push(`ไม่รู้จัก section ชนิด "${section.type}"`);
      continue;
    }
    const parsed = def.schema.safeParse(section.settings);
    if (!parsed.success) {
      issues.push(`"${def.label}" ตั้งค่าไม่ครบหรือผิดรูปแบบ`);
    }
    const count = (seen.get(section.type) ?? 0) + 1;
    seen.set(section.type, count);
    if (def.maxPerPage && count > def.maxPerPage) {
      issues.push(`"${def.label}" ใส่ได้สูงสุด ${def.maxPerPage} อันต่อหน้า`);
    }
    // The last of the three gates. A hidden locked section is a page that
    // looks finished in the editor and does nothing on the site: /shop with
    // no filters, a product page with no buy button. The editor refuses to
    // make one and the save route refuses to store one, so reaching here
    // means the document came from somewhere else — which is exactly when a
    // check is worth having.
    if (def.locked && section.common?.hidden) {
      issues.push(`"${def.label}" เป็นส่วนของระบบ ซ่อนไม่ได้ — ถ้าซ่อน หน้านี้จะใช้งานไม่ได้`);
    }
  }
  return issues;
}

/**
 * Locked sections the incoming draft has dropped or hidden.
 *
 * The second of the three gates, and the first that is actually a gate: the
 * editor's guards make the right thing easy, this one makes the wrong thing
 * impossible. It compares against what is already stored rather than against
 * a list of what each page ought to have, because the question here is not
 * "is this page well formed" but "did this save take something away that the
 * page is not allowed to lose".
 *
 * Matched by id, not by type. Two sections of one locked type cannot exist
 * (they carry maxPerPage: 1), but an id match also survives a type being
 * renamed under a document, and says exactly which block went missing.
 */
export function lockedSectionsLost(previous: PageDoc, next: PageDoc): string[] {
  const incoming = new Map(next.sections.map((s) => [s.id, s]));
  const issues: string[] = [];
  for (const was of previous.sections) {
    const def = SECTION_REGISTRY[was.type];
    if (!def?.locked) continue;
    const now = incoming.get(was.id);
    if (!now) issues.push(`"${def.label}" เป็นส่วนของระบบ ลบออกจากหน้านี้ไม่ได้`);
    else if (now.common?.hidden) issues.push(`"${def.label}" เป็นส่วนของระบบ ซ่อนไม่ได้`);
  }
  return issues;
}

export type PublishIssues = { errors: string[]; warnings: string[] };

/**
 * Everything the publish checklist has to say: the structural rules above,
 * plus every section's own `check`.
 *
 * The per-section checks are the half that can only be answered against the
 * world — "does this discount code still exist", "are any of these products
 * actually in stock", "is there a mobile banner". They are declared on the
 * definitions and were, until now, never run: the type invited them, nothing
 * called them, and a dozen sections had written checks that did nothing. This
 * is where they run.
 *
 * Errors block publishing. Warnings are read and then published past. The
 * split is the point — a checklist where everything is equally alarming is a
 * checklist people learn to click through, and then the one real error goes
 * through with the rest.
 *
 * A check that throws becomes a warning rather than taking the publish down.
 * It is asking a question about the outside world, and the outside world is
 * allowed to be unreachable.
 */
export async function collectPublishIssues(doc: PageDoc, page?: PageRow): Promise<PublishIssues> {
  const errors = validateForPublish(doc, page);
  const warnings: string[] = [];

  const ctx: RenderCtx = {
    kind: page?.kind ?? "page",
    slug: page?.slug ?? "",
    now: new Date(),
    phase: page?.kind === "campaign" ? campaignPhaseAt(campaignTimesOf(page), new Date()) : undefined,
    times: page?.kind === "campaign" ? campaignTimesOf(page) : undefined,
    isPreview: false,
  };

  await Promise.all(
    doc.sections.map(async (section) => {
      const def = SECTION_REGISTRY[section.type] as AnySectionDefinition | undefined;
      if (!def?.check) return;

      // A section whose settings do not parse is already an error above; its
      // check would only be guessing at what they meant.
      const parsed = def.schema.safeParse(section.settings);
      if (!parsed.success) return;

      try {
        for (const issue of await def.check(parsed.data, ctx)) {
          (issue.level === "error" ? errors : warnings).push(`${def.label}: ${issue.message}`);
        }
      } catch (err) {
        console.error(`[pages] check for section ${section.id} (${section.type}) threw`, err);
        warnings.push(`${def.label}: ตรวจไม่สำเร็จ — ลองดูด้วยตาก่อนเผยแพร่`);
      }
    })
  );

  return { errors, warnings };
}

/**
 * Writes the draft, refusing if someone else has written since you read.
 *
 * The version check is the whole safety: two tabs open on one page is an
 * ordinary thing to happen, and the losing write silently erasing the other
 * person's afternoon is the failure this exists to prevent. PostgREST does
 * the compare in the WHERE clause, so there is no window between checking
 * and writing.
 */
export async function saveDraft(opts: {
  pageId: string;
  expectedVersion: number;
  doc: unknown;
  actor: string;
}): Promise<SaveResult> {
  const doc = migrateDoc(opts.doc);

  // Saving is deliberately more forgiving than publishing: half-filled
  // settings are what a draft looks like while someone is still typing.
  // Unknown section types are not forgiven, because nothing in the editor
  // can produce one — it means the document came from somewhere else.
  const unknown = doc.sections.filter((s) => !SECTION_REGISTRY[s.type]).map((s) => s.type);
  if (unknown.length) {
    return { ok: false, reason: "invalid", issues: [`ไม่รู้จัก section ชนิด: ${[...new Set(unknown)].join(", ")}`] };
  }

  const next = opts.expectedVersion + 1;
  const updated = await supabaseRest<PageRow[]>(
    `pages?id=eq.${pgValue(opts.pageId)}&draft_version=eq.${opts.expectedVersion}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        draft_doc: doc,
        draft_version: next,
        draft_updated_by: opts.actor,
        draft_updated_at: new Date().toISOString(),
      }),
    }
  );

  if (updated.length === 0) {
    const [current] = await supabaseRest<PageRow[]>(`pages?select=*&id=eq.${pgValue(opts.pageId)}&limit=1`);
    return { ok: false, reason: "conflict", current };
  }
  return { ok: true, version: next };
}

/**
 * Makes the current draft the live page.
 *
 * The revision is written first and the pointer moved second. In that order
 * the worst case is a revision nobody points at — invisible and harmless. The
 * other order risks a pointer to a revision that was never written, which is
 * a page that cannot render.
 */
export async function publish(opts: {
  page: PageRow;
  note?: string;
  actor: string;
}): Promise<{ ok: true; number: number } | { ok: false; issues: string[] }> {
  const doc = migrateDoc(opts.page.draft_doc);
  const { errors } = await collectPublishIssues(doc, opts.page);
  if (errors.length) return { ok: false, issues: errors };

  const [last] = await supabaseRest<{ number: number }[]>(
    `page_revisions?select=number&page_id=eq.${pgValue(opts.page.id)}&order=number.desc&limit=1`
  );
  const number = (last?.number ?? 0) + 1;

  const [revision] = await supabaseRest<{ id: string }[]>("page_revisions", {
    method: "POST",
    body: JSON.stringify({
      page_id: opts.page.id,
      number,
      doc,
      schema_version: SCHEMA_VERSION,
      note: opts.note ?? null,
      published_by: opts.actor,
    }),
  });
  if (!revision) return { ok: false, issues: ["บันทึกเวอร์ชันไม่สำเร็จ"] };

  await pointAt(opts.page, revision.id, doc);
  return { ok: true, number };
}

/**
 * Puts a previous version back.
 *
 * Nothing is rewritten and nothing is deleted — the pointer moves to a
 * revision that is already there. That is why going back takes no deploy and
 * cannot fail halfway: the document being restored was already valid enough
 * to publish once.
 */
export async function rollback(opts: {
  page: PageRow;
  revisionId: string;
  actor: string;
}): Promise<{ ok: true; number: number } | { ok: false; issues: string[] }> {
  const [revision] = await supabaseRest<{ id: string; number: number; doc: unknown }[]>(
    `page_revisions?select=id,number,doc&id=eq.${pgValue(opts.revisionId)}&page_id=eq.${pgValue(opts.page.id)}&limit=1`
  );
  if (!revision) return { ok: false, issues: ["ไม่พบเวอร์ชันนี้"] };

  await pointAt(opts.page, revision.id, migrateDoc(revision.doc));
  return { ok: true, number: revision.number };
}

/** The four campaign dates off a page row, in the shape the pure helpers
 *  want. One place, so a renamed column is one edit. */
export function campaignTimesOf(page: PageRow): CampaignTimes {
  return {
    teaserAt: page.campaign_teaser_at,
    liveAt: page.campaign_live_at,
    extendedAt: page.campaign_extended_at,
    endsAt: page.campaign_ends_at,
  };
}

/**
 * When this page next renders differently: the earliest of its sections'
 * own windows and, for a campaign, its next phase change.
 *
 * Both have to be in the same column because the scheduler finds work with
 * one indexed comparison. Taking only the section boundaries would leave a
 * campaign showing its teaser an hour into the sale — the phase is decided
 * on the server, and nothing would have asked the server again.
 */
export function nextBoundaryFor(page: PageRow, doc: PageDoc, now: Date): string | null {
  const candidates = [nextBoundaryAfter(doc, now)];
  if (page.kind === "campaign") candidates.push(nextPhaseBoundaryAfter(campaignTimesOf(page), now));

  const times = candidates.filter((value): value is string => value !== null).map((value) => Date.parse(value));
  if (times.length === 0) return null;
  return new Date(Math.min(...times)).toISOString();
}

/** Moves the published pointer and makes the change visible immediately. */
async function pointAt(page: PageRow, revisionId: string, doc: PageDoc) {
  await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      published_revision_id: revisionId,
      status: "published",
      // When this page next changes by itself — a section window opening or
      // a campaign phase turning over — so the cron job can find the pages
      // that need re-rendering with one indexed comparison.
      next_boundary_at: nextBoundaryFor(page, doc, new Date()),
    }),
  });

  // expire: 0 rather than the one-argument form, which Next 16 deprecated.
  // Without this the document the storefront has cached stays up for a day.
  revalidateTag(pageTag(page.kind, page.slug), { expire: 0 });
  revalidateTag("pages", { expire: 0 });
}
