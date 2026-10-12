import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { openPage, publish, rollback, saveDraft, validateForPublish } from "@/lib/pages/admin";
import { migrateDoc } from "@/lib/pages/doc";
import { sectionsFor } from "@/sections/registry";
import type { PageKind } from "@/lib/pages/types";

// One page, for the editor.
//
// GET  — the draft, its version, the section library for this kind of page,
//        and the versions already published. Creates the home page from the
//        built-in document the first time it is opened.
// PUT  — save the draft. Carries the version it was read at; a mismatch is a
//        409 rather than a silent overwrite of somebody else's work.
// POST — publish, or put a previous version back.

const KINDS: PageKind[] = ["home", "page", "campaign", "brand"];

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

function actorOf(token: string | undefined) {
  // A legacy shared-password session has no "who" to record, which is worth
  // storing as such rather than inventing a name for.
  return getAdminSession(token)?.userId ?? "shared-login";
}

async function params(props: { params: Promise<{ kind: string; slug: string }> }) {
  const p = await props.params;
  const kind = KINDS.find((k) => k === p.kind);
  return kind ? { kind, slug: p.slug } : null;
}

export async function GET(req: NextRequest, props: { params: Promise<{ kind: string; slug: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const target = await params(props);
  if (!target) return NextResponse.json({ ok: false, error: "ไม่รู้จักประเภทเพจนี้" }, { status: 400 });

  const page = await openPage(target.kind, target.slug, actorOf(token));
  if (!page) return NextResponse.json({ ok: false, error: "ไม่พบเพจนี้" }, { status: 404 });

  const revisions = await supabaseRest<
    { id: string; number: number; note: string | null; published_by: string | null; published_at: string }[]
  >(
    `page_revisions?select=id,number,note,published_by,published_at` +
      `&page_id=eq.${pgValue(page.id)}&order=number.desc&limit=30`
  );

  const doc = migrateDoc(page.draft_doc);
  return NextResponse.json({
    ok: true,
    page: {
      id: page.id,
      kind: page.kind,
      slug: page.slug,
      title: page.title,
      status: page.status,
      draftVersion: page.draft_version,
      draftUpdatedBy: page.draft_updated_by,
      draftUpdatedAt: page.draft_updated_at,
      publishedRevisionId: page.published_revision_id,
    },
    doc,
    // The library panel only ever offers what this kind of page may hold, so
    // a campaign section cannot be dropped onto the home page by hand.
    library: sectionsFor(target.kind).map((def) => ({
      type: def.type,
      version: def.version,
      label: def.label,
      description: def.description,
      category: def.category,
      maxPerPage: def.maxPerPage ?? null,
      defaults: def.defaults,
      fields: def.fields,
    })),
    revisions,
    issues: validateForPublish(doc),
  });
}

export async function PUT(req: NextRequest, props: { params: Promise<{ kind: string; slug: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const target = await params(props);
  if (!target) return NextResponse.json({ ok: false, error: "ไม่รู้จักประเภทเพจนี้" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { doc?: unknown; version?: number } | null;
  if (!body || typeof body.version !== "number") {
    return NextResponse.json({ ok: false, error: "ไม่ได้ส่งเลขเวอร์ชันมาด้วย" }, { status: 400 });
  }

  const page = await openPage(target.kind, target.slug, actorOf(token));
  if (!page) return NextResponse.json({ ok: false, error: "ไม่พบเพจนี้" }, { status: 404 });

  const result = await saveDraft({
    pageId: page.id,
    expectedVersion: body.version,
    doc: body.doc,
    actor: actorOf(token),
  });

  if (result.ok === false && result.reason === "conflict") {
    // 409 and the current state, so the editor can say who wrote last and
    // when rather than just refusing.
    return NextResponse.json(
      {
        ok: false,
        error: "มีคนแก้หน้านี้ไปแล้วหลังจากที่คุณเปิด",
        conflict: {
          version: result.current?.draft_version ?? null,
          by: result.current?.draft_updated_by ?? null,
          at: result.current?.draft_updated_at ?? null,
        },
      },
      { status: 409 }
    );
  }
  if (result.ok === false) {
    return NextResponse.json({ ok: false, error: result.issues.join(" · ") }, { status: 400 });
  }

  return NextResponse.json({ ok: true, version: result.version });
}

export async function POST(req: NextRequest, props: { params: Promise<{ kind: string; slug: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const target = await params(props);
  if (!target) return NextResponse.json({ ok: false, error: "ไม่รู้จักประเภทเพจนี้" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as
    | { action?: "publish" | "rollback"; note?: string; revisionId?: string }
    | null;

  const page = await openPage(target.kind, target.slug, actorOf(token));
  if (!page) return NextResponse.json({ ok: false, error: "ไม่พบเพจนี้" }, { status: 404 });
  const actor = actorOf(token);

  if (body?.action === "rollback") {
    if (!body.revisionId) return NextResponse.json({ ok: false, error: "ไม่ได้ระบุเวอร์ชัน" }, { status: 400 });
    const result = await rollback({ page, revisionId: body.revisionId, actor });
    if (result.ok === false) {
      return NextResponse.json({ ok: false, error: result.issues.join(" · ") }, { status: 400 });
    }
    await audit("page.rollback", page.id, `ย้อนกลับไปเวอร์ชัน ${result.number}`, actor);
    return NextResponse.json({ ok: true, number: result.number });
  }

  const result = await publish({ page, note: body?.note, actor });
  if (result.ok === false) {
    // The issues go back as a list as well as a sentence: the editor shows
    // them beside the sections they belong to, not only in a toast.
    return NextResponse.json({ ok: false, error: result.issues.join(" · "), issues: result.issues }, { status: 400 });
  }
  await audit("page.publish", page.id, `เผยแพร่เวอร์ชัน ${result.number}`, actor);
  return NextResponse.json({ ok: true, number: result.number });
}

/** Best effort: a page that went live is more important than its log line. */
async function audit(action: string, target: string, detail: string, actor: string) {
  try {
    await supabaseRest("admin_audit_log", {
      method: "POST",
      returning: false,
      body: JSON.stringify({ action, actor, target, detail }),
    });
  } catch (err) {
    console.error("[pages] could not write the audit entry", err);
  }
}
