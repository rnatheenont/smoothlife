import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { revalidateTag } from "next/cache";
import { migrateDoc, nextBoundaryAfter, SCHEMA_VERSION, type PageDoc } from "./doc";
import { defaultHomeDoc } from "./default-docs/home";
import { pageTag, type PageRow } from "./store";
import { SECTION_REGISTRY } from "@/sections/registry";
import type { PageKind } from "./types";

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
export async function openPage(kind: PageKind, slug: string, actor: string): Promise<PageRow | null> {
  if (!supabaseConfigured()) return null;

  const [existing] = await supabaseRest<PageRow[]>(
    `pages?select=*&kind=eq.${pgValue(kind)}&slug=eq.${pgValue(slug)}&limit=1`
  );
  if (existing) return existing;

  // Only the home page can be conjured out of nothing; every other kind is
  // created deliberately, with a title someone chose.
  if (!(kind === "home" && slug === "home")) return null;

  const [created] = await supabaseRest<PageRow[]>("pages", {
    method: "POST",
    body: JSON.stringify({
      kind,
      slug,
      title: "หน้าแรก",
      status: "draft",
      draft_doc: defaultHomeDoc(),
      draft_updated_by: actor,
      created_by: actor,
    }),
  });
  return created ?? null;
}

/** Problems that should stop a draft becoming the live page. */
export function validateForPublish(doc: PageDoc): string[] {
  const issues: string[] = [];
  const seen = new Map<string, number>();

  if (doc.sections.length === 0) issues.push("เพจนี้ยังไม่มี section เลย");

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
  }
  return issues;
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
  const issues = validateForPublish(doc);
  if (issues.length) return { ok: false, issues };

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

/** Moves the published pointer and makes the change visible immediately. */
async function pointAt(page: PageRow, revisionId: string, doc: PageDoc) {
  await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      published_revision_id: revisionId,
      status: "published",
      // When the next scheduled section boundary is, so the cron job can find
      // pages that need re-rendering with one indexed comparison.
      next_boundary_at: nextBoundaryAfter(doc, new Date()),
    }),
  });

  // expire: 0 rather than the one-argument form, which Next 16 deprecated.
  // Without this the document the storefront has cached stays up for a day.
  revalidateTag(pageTag(page.kind, page.slug), { expire: 0 });
  revalidateTag("pages", { expire: 0 });
}
