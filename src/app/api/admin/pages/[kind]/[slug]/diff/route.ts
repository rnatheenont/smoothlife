import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { migrateDoc, type PageDoc } from "@/lib/pages/doc";
import { diffDocs } from "@/lib/pages/diff";
import { SECTION_REGISTRY } from "@/sections/registry";
import { PAGE_KINDS } from "@/lib/pages/system-pages";

// What changed, in words.
//
// The comparison itself is pure and tested (lib/pages/diff). This route does
// the half that needs the server: turning "the key `ctaLabel` differs" into
// "ข้อความบนปุ่ม", which means reading the section's own field labels from
// the registry — the same labels the form shows, so the person reading the
// diff recognises what they are being told.
//
// ?from=<revision id> compares that published version against the current
// draft, which is the question the editor asks. ?from=published compares the
// live version against the draft, which is the question an approver asks:
// "what am I about to put on the site".

const KINDS = PAGE_KINDS;

const COMMON_LABEL: Record<string, string> = {
  hidden: "ซ่อน/แสดง",
  visibleFrom: "เวลาเริ่มแสดง",
  visibleUntil: "เวลาหยุดแสดง",
  phases: "ช่วงของแคมเปญที่แสดง",
};

/** A section's own words for its settings. Falls back to the raw key, which
 *  is ugly but true — better than inventing a name for a field the
 *  definition never gave one. */
function fieldLabels(type: string): Record<string, string> {
  const def = SECTION_REGISTRY[type];
  if (!def) return {};
  return Object.fromEntries(def.fields.map((f) => [f.key, f.label]));
}

const labelOf = (type: string) => SECTION_REGISTRY[type]?.label ?? type;

export async function GET(req: NextRequest, props: { params: Promise<{ kind: string; slug: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const p = await props.params;
  const kind = KINDS.find((k) => k === p.kind);
  if (!kind) return NextResponse.json({ ok: false, error: "ไม่รู้จักประเภทเพจนี้" }, { status: 400 });

  const [page] = await supabaseRest<
    { id: string; draft_doc: unknown; published_revision_id: string | null }[]
  >(`pages?select=id,draft_doc,published_revision_id&kind=eq.${pgValue(kind)}&slug=eq.${pgValue(p.slug)}&limit=1`);
  if (!page) return NextResponse.json({ ok: false, error: "ไม่พบเพจนี้" }, { status: 404 });

  const from = req.nextUrl.searchParams.get("from") ?? "published";
  const revisionId = from === "published" ? page.published_revision_id : from;
  if (!revisionId) {
    // Nothing published yet: everything in the draft is new, and saying so is
    // more useful than refusing to answer.
    const draft = migrateDoc(page.draft_doc);
    return NextResponse.json({
      ok: true,
      baseline: null,
      diff: describe({ schemaVersion: draft.schemaVersion, sections: [] }, draft),
    });
  }

  const [revision] = await supabaseRest<{ doc: unknown; number: number; published_at: string }[]>(
    `page_revisions?select=doc,number,published_at&id=eq.${pgValue(revisionId)}&page_id=eq.${pgValue(page.id)}&limit=1`
  );
  if (!revision) return NextResponse.json({ ok: false, error: "ไม่พบเวอร์ชันนี้" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    baseline: { number: revision.number, publishedAt: revision.published_at },
    diff: describe(migrateDoc(revision.doc), migrateDoc(page.draft_doc)),
  });
}

/** The pure diff, with every id and key replaced by what a person calls it. */
function describe(before: PageDoc, after: PageDoc) {
  const diff = diffDocs(before, after);
  return {
    same: diff.same,
    added: diff.added.map((s) => ({ ...s, label: labelOf(s.type) })),
    removed: diff.removed.map((s) => ({ ...s, label: labelOf(s.type) })),
    moved: diff.moved.map((s) => ({ ...s, label: labelOf(s.type) })),
    changed: diff.changed.map((c) => {
      const labels = fieldLabels(c.type);
      return {
        id: c.id,
        label: labelOf(c.type),
        fields: [
          ...c.keys.map((k) => labels[k] ?? k),
          ...c.common.map((k) => COMMON_LABEL[k] ?? k),
        ],
      };
    }),
  };
}
