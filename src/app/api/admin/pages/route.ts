import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { SCHEMA_VERSION, migrateDoc } from "@/lib/pages/doc";
import { newSectionId } from "@/lib/pages/edit";
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
const RESERVED = new Set(["admin", "api", "shop", "cart", "checkout", "chat", "search", "home", "p"]);

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
  return NextResponse.json({ ok: true, pages });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as
    | { slug?: string; title?: string; action?: "duplicate"; fromKind?: PageKind; fromSlug?: string }
    | null;
  const slug = (body?.slug ?? "").trim().toLowerCase();
  const title = (body?.title ?? "").trim();

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

  const [existing] = await supabaseRest<{ id: string }[]>(
    `pages?select=id&kind=eq.page&slug=eq.${pgValue(slug)}&limit=1`
  );
  if (existing) return NextResponse.json({ ok: false, error: "มีหน้าที่ใช้ที่อยู่นี้อยู่แล้ว" }, { status: 409 });

  const actor = getAdminSession(token)?.userId ?? "shared-login";

  // A copy of an existing page: same sections, new ids, nothing published.
  //
  // The copy starts as a draft even when the original is live. That is the
  // point of copying — the usual reason is to try a change on a page that is
  // already working, and a copy that went live on creation would put two
  // versions of the same page in front of customers at once.
  let draftDoc: unknown = { schemaVersion: SCHEMA_VERSION, sections: [] };
  if (body?.action === "duplicate") {
    const [source] = await supabaseRest<{ draft_doc: unknown }[]>(
      `pages?select=draft_doc&kind=eq.${pgValue(body.fromKind ?? "")}&slug=eq.${pgValue(body.fromSlug ?? "")}&limit=1`
    );
    if (!source) return NextResponse.json({ ok: false, error: "ไม่พบหน้าต้นทางที่จะคัดลอก" }, { status: 404 });
    const migrated = migrateDoc(source.draft_doc);
    // Fresh ids: an id is what a preview link, an error report and the
    // scheduler all point at, so two pages must never share one.
    draftDoc = {
      schemaVersion: SCHEMA_VERSION,
      sections: migrated.sections.map((section) => ({ ...section, id: newSectionId() })),
    };
  }

  const [created] = await supabaseRest<{ id: string; slug: string }[]>("pages", {
    method: "POST",
    body: JSON.stringify({
      kind: "page",
      slug,
      title,
      status: "draft",
      // Empty unless this is a copy: the editor opens on the section library
      // and the first choice is the person's, not ours.
      draft_doc: draftDoc,
      draft_updated_by: actor,
      created_by: actor,
    }),
  });

  return NextResponse.json({ ok: true, page: created });
}
