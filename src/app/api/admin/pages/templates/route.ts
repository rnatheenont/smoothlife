import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { migrateDoc, SCHEMA_VERSION } from "@/lib/pages/doc";
import { newSectionId } from "@/lib/pages/edit";
import { CAMPAIGN_TEMPLATES } from "@/lib/pages/default-docs/campaign-templates";
import type { PageKind } from "@/lib/pages/types";

// Saved arrangements of sections, and starting a page from one.
//
// A template is a document with the ids stripped. That matters: section ids
// are what a preview click, an error report and a future A/B split point at,
// so two pages made from one template must not share them — otherwise a
// report about "section s-4f2a" names two different things.

type TemplateRow = {
  id: string;
  scope: "page" | "section";
  kind: string | null;
  name: string;
  description: string | null;
  doc: unknown;
  is_system: boolean;
  created_at: string;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

/** Fresh ids throughout, so nothing made from this template is confusable
 *  with anything else made from it. */
function reissueIds(doc: unknown) {
  const page = migrateDoc(doc);
  return {
    schemaVersion: SCHEMA_VERSION,
    sections: page.sections.map((section) => ({ ...section, id: newSectionId() })),
  };
}

/**
 * Puts the ready-made campaign templates in the database if they are not
 * there yet.
 *
 * Seeded on first read rather than in a migration, for the same reason the
 * home page is: the documents are assembled from the section definitions in
 * the code, so SQL cannot build them and a copy pasted into a migration would
 * be a second source of truth that drifts the moment a default changes.
 *
 * Matched by name. A system template someone has since edited is left alone —
 * re-seeding over the top of it would quietly undo their work every time an
 * admin opened the editor.
 */
async function seedSystemTemplates() {
  const existing = await supabaseRest<{ name: string }[]>(
    "page_templates?select=name&is_system=is.true&limit=50"
  );
  const have = new Set(existing.map((row) => row.name));
  const missing = CAMPAIGN_TEMPLATES.filter((t) => !have.has(t.name));
  if (missing.length === 0) return;

  await supabaseRest("page_templates", {
    method: "POST",
    returning: false,
    body: JSON.stringify(
      missing.map((t) => ({
        scope: "page",
        kind: "campaign",
        name: t.name,
        description: t.description,
        doc: t.doc,
        is_system: true,
        created_by: "system",
      }))
    ),
  });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  try {
    await seedSystemTemplates();
  } catch (err) {
    // A missing ready-made template is a missing convenience. The list of
    // templates the team saved themselves still has to come back.
    console.error("[pages] could not seed the system templates", err);
  }

  const kind = req.nextUrl.searchParams.get("kind");
  const where = kind ? `&or=(kind.is.null,kind.eq.${encodeURIComponent(kind)})` : "";
  const templates = await supabaseRest<TemplateRow[]>(
    `page_templates?select=id,scope,kind,name,description,is_system,created_at${where}&order=is_system.desc,name&limit=100`
  );
  return NextResponse.json({ ok: true, templates });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as
    | {
        action?: "save" | "apply";
        /** save: where the sections come from */
        fromKind?: PageKind;
        fromSlug?: string;
        name?: string;
        description?: string;
        /** apply: which template, onto which page */
        templateId?: string;
        toKind?: PageKind;
        toSlug?: string;
      }
    | null;

  const actor = getAdminSession(token)?.userId ?? "shared-login";

  if (body?.action === "save") {
    if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งชื่อ template" }, { status: 400 });
    const [page] = await supabaseRest<{ draft_doc: unknown; kind: string }[]>(
      `pages?select=draft_doc,kind&kind=eq.${pgValue(body.fromKind ?? "")}&slug=eq.${pgValue(body.fromSlug ?? "")}&limit=1`
    );
    if (!page) return NextResponse.json({ ok: false, error: "ไม่พบเพจต้นทาง" }, { status: 404 });

    const doc = reissueIds(page.draft_doc);
    if (doc.sections.length === 0) {
      return NextResponse.json({ ok: false, error: "เพจนี้ยังไม่มี section ให้บันทึก" }, { status: 400 });
    }

    const [template] = await supabaseRest<TemplateRow[]>("page_templates", {
      method: "POST",
      body: JSON.stringify({
        scope: "page",
        // Null rather than the source kind: a arrangement of text and
        // products is just as useful on a campaign as on a plain page, and
        // locking it to one kind is a restriction nobody asked for.
        kind: null,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        doc,
        is_system: false,
        created_by: actor,
      }),
    });
    return NextResponse.json({ ok: true, template });
  }

  if (body?.action === "apply") {
    const [template] = await supabaseRest<TemplateRow[]>(
      `page_templates?select=*&id=eq.${pgValue(body.templateId ?? "")}&limit=1`
    );
    if (!template) return NextResponse.json({ ok: false, error: "ไม่พบ template นี้" }, { status: 404 });

    const [page] = await supabaseRest<{ id: string; draft_version: number }[]>(
      `pages?select=id,draft_version&kind=eq.${pgValue(body.toKind ?? "")}&slug=eq.${pgValue(body.toSlug ?? "")}&limit=1`
    );
    if (!page) return NextResponse.json({ ok: false, error: "ไม่พบเพจปลายทาง" }, { status: 404 });

    // Replaces the draft, not the published page. Applying a template to a
    // live page would otherwise change what customers see with no review and
    // no revision in between.
    await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({
        draft_doc: reissueIds(template.doc),
        draft_version: page.draft_version + 1,
        draft_updated_by: actor,
        draft_updated_at: new Date().toISOString(),
      }),
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "ไม่รู้จักคำสั่งนี้" }, { status: 400 });
}
