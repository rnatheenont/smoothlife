import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { SCHEMA_VERSION, migrateDoc } from "@/lib/pages/doc";
import { newSectionId } from "@/lib/pages/edit";
import {
  reservedTopLevelSegments,
  SYSTEM_PAGE_LIST,
  GLOBAL_LIST_ALL,
  TEMPLATE_LIST_ALL,
} from "@/lib/pages/system-pages";
import { waveEnabled } from "@/lib/feature-flags";
import { DEFAULT_DOCS } from "@/lib/pages/admin";
import type { PageKind } from "@/lib/pages/types";

// The list of pages, and making a new one.
//
// The home page is not created here — it is seeded the first time somebody
// opens it, because its content comes from the code. Everything else starts
// empty and deliberately: a new page is a decision, with a name and an
// address someone chose.

type PageListRow = {
  id: string;
  kind: PageKind;
  slug: string;
  title: string;
  status: string;
  draft_updated_at: string;
  draft_updated_by: string | null;
  published_revision_id: string | null;
};

/** Lower case, letters, digits and single hyphens. It becomes a URL, and a
 *  URL with a space or a capital in it is one that gets mistyped, shared
 *  wrong, and then reported as a broken link. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Addresses the site already uses for something else. A page at /p/admin is
 *  not a conflict today — /p/ has its own space — but a slug that reads like
 *  a system route invites someone to link to the wrong one. */
// Addresses a /p/ page may not take. The hand-written half is the parts of
// the site that are not pages at all (admin, api) plus the two prefixes the
// page system itself owns; the rest comes from the system-page registry, so
// adding a page to it closes that address in the same edit rather than in a
// second one somebody has to remember.
const RESERVED = new Set([
  "admin",
  "api",
  "p",
  "sale",
  "home",
  "checkout",
  "chat",
  ...reservedTopLevelSegments(),
]);

/** The kinds that can be created from the admin. "home" is missing on
 *  purpose — there is one home page and it seeds itself from the code. */
const CREATABLE: PageKind[] = ["page", "campaign", "brand"];

/** Where a page of each kind lives, for the error messages and the response. */
const ADDRESS: Record<string, (slug: string) => string> = {
  page: (slug) => `/p/${slug}`,
  campaign: (slug) => `/sale/${slug}`,
  brand: (slug) => `/brands/${slug}`,
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const pages = await supabaseRest<PageListRow[]>(
    `pages?select=id,kind,slug,title,status,draft_updated_at,draft_updated_by,published_revision_id` +
      `&order=kind,slug&limit=200`
  );
  return NextResponse.json({ ok: true, pages, registry: openRegistry() });
}

/**
 * The pages the shop already has that are ready to be edited.
 *
 * Decided here rather than in the browser because readiness is two things
 * the server knows and the client does not: the wave has to be switched on,
 * and a default document has to exist. A page offered without one opens an
 * empty editor, and publishing that would replace a working page with
 * nothing — which is worse than the page not being listed yet.
 */
function openRegistry() {
  const ready = (kind: string, key: string) => Boolean(DEFAULT_DOCS[`${kind}/${key}`]);
  return {
    system: SYSTEM_PAGE_LIST.filter((p) => waveEnabled(p.wave) && ready("system", p.key)).map((p) => ({
      key: p.key,
      title: p.title,
      group: p.group,
      path: p.path,
    })),
    globals: GLOBAL_LIST_ALL.filter((g) => waveEnabled(g.wave) && ready("global", g.key)).map((g) => ({
      key: g.key,
      title: g.title,
      shownOn: g.shownOn,
    })),
    templates: TEMPLATE_LIST_ALL.filter((t) => waveEnabled(t.wave) && ready("template", t.key)).map((t) => ({
      key: t.key,
      title: t.title,
      scale: t.scale,
      pattern: t.pattern,
    })),
  };
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as
    | {
        slug?: string;
        title?: string;
        kind?: PageKind;
        action?: "duplicate";
        fromKind?: PageKind;
        fromSlug?: string;
      }
    | null;
  const slug = (body?.slug ?? "").trim().toLowerCase();
  const title = (body?.title ?? "").trim();
  // A copy is the same kind as its original unless told otherwise, and
  // anything else defaults to a plain page — which is what the create form
  // sends and what every page made before campaigns existed was.
  const kind = CREATABLE.find((k) => k === (body?.kind ?? body?.fromKind ?? "page"));

  if (!kind) {
    return NextResponse.json(
      { ok: false, error: "สร้างได้เฉพาะหน้าเว็บ แคมเปญ และหน้าแบรนด์" },
      { status: 400 }
    );
  }
  if (!title) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งชื่อหน้า" }, { status: 400 });
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json(
      { ok: false, error: "ที่อยู่หน้าใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง เช่น about-us" },
      { status: 400 }
    );
  }
  if (RESERVED.has(slug)) {
    return NextResponse.json({ ok: false, error: `"${slug}" เป็นที่อยู่ที่ระบบใช้อยู่แล้ว` }, { status: 400 });
  }

  // Scoped to the kind: /p/11-11 and /sale/11-11 are different addresses, so
  // a campaign is not blocked by a page that happens to share its slug.
  const [existing] = await supabaseRest<{ id: string }[]>(
    `pages?select=id&kind=eq.${pgValue(kind)}&slug=eq.${pgValue(slug)}&limit=1`
  );
  if (existing) {
    return NextResponse.json(
      { ok: false, error: `มีหน้าที่ใช้ที่อยู่ ${ADDRESS[kind](slug)} อยู่แล้ว` },
      { status: 409 }
    );
  }

  const actor = getAdminSession(token)?.userId ?? "shared-login";

  // A copy of an existing page: same sections, new ids, nothing published.
  //
  // The copy starts as a draft even when the original is live. That is the
  // point of copying — the usual reason is to try a change on a page that is
  // already working, and a copy that went live on creation would put two
  // versions of the same page in front of customers at once.
  let draftDoc: unknown = { schemaVersion: SCHEMA_VERSION, sections: [] };
  let carried: Record<string, unknown> = {};
  if (body?.action === "duplicate") {
    const [source] = await supabaseRest<{ draft_doc: unknown; campaign_theme: unknown }[]>(
      `pages?select=draft_doc,campaign_theme&kind=eq.${pgValue(body.fromKind ?? "")}` +
        `&slug=eq.${pgValue(body.fromSlug ?? "")}&limit=1`
    );
    if (!source) return NextResponse.json({ ok: false, error: "ไม่พบหน้าต้นทางที่จะคัดลอก" }, { status: 404 });
    const migrated = migrateDoc(source.draft_doc);
    // Fresh ids: an id is what a preview link, an error report and the
    // scheduler all point at, so two pages must never share one.
    draftDoc = {
      schemaVersion: SCHEMA_VERSION,
      sections: migrated.sections.map((section) => ({ ...section, id: newSectionId() })),
    };

    // The colours come across; the dates deliberately do not.
    //
    // Copying a campaign is how next year's 11.11 gets made from this year's
    // (plan §6.1 — the slug is reused on purpose). Carrying the dates over
    // would create a campaign that is already in its "ended" phase on the
    // day it is born, which looks exactly like a bug and is tedious to
    // undo. The look is worth keeping; last November is not.
    if (kind === "campaign") carried = { campaign_theme: source.campaign_theme ?? null, takeover_home: false };
  }

  const [created] = await supabaseRest<{ id: string; slug: string; kind: PageKind }[]>("pages", {
    method: "POST",
    body: JSON.stringify({
      kind,
      slug,
      title,
      status: "draft",
      // Empty unless this is a copy: the editor opens on the section library
      // and the first choice is the person's, not ours.
      draft_doc: draftDoc,
      ...carried,
      draft_updated_by: actor,
      created_by: actor,
    }),
  });

  return NextResponse.json({ ok: true, page: created });
}
