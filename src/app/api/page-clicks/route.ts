import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

// "Somebody pressed something in this section."
//
// Public, because the people clicking are customers. That shapes everything
// here: the body is three short strings and a small number, nothing is read
// back, and the answer is 204 whatever happens — a counter that reports
// whether a page exists is a way to enumerate unpublished pages.
//
// What it does not take: who clicked. No id, no session, no fingerprint. The
// question the stats page answers is "which section do people press", and
// the honest way to answer it is to count presses, not people.
//
// sendBeacon posts this during the click that navigates away, so it has to
// be cheap and it has to not block. Hence runtime nodejs with no auth, no
// cookies read, and one RPC that is itself bounded (see the migration).

export const runtime = "nodejs";

const KINDS = new Set(["home", "page", "campaign", "brand"]);
/** Matches newSectionId() and the fixed ids in the built-in documents.
 *  Checked by shape rather than against the registry on purpose: a section
 *  type that has since been removed from the code still has clicks from the
 *  weeks it was live, and a report that silently drops them is a report that
 *  lies about what the page used to do. */
const SECTION_ID = /^[a-z0-9-]{1,60}$/i;
const SLUG = /^[a-z0-9-]{1,120}$/i;
/** Must match the ceiling in the migration; the database enforces it too,
 *  because this route is not the only thing that can call the RPC. */
const MAX_PER_SECTION = 20;

export async function POST(req: NextRequest) {
  // 204 on every path below. The caller is a beacon that cannot read the
  // answer anyway, and a different status for "bad input" is a free oracle.
  const done = new NextResponse(null, { status: 204 });
  if (!supabaseConfigured()) return done;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return done;
  }

  const { kind, slug, sections } = (body ?? {}) as {
    kind?: string;
    slug?: string;
    sections?: Record<string, number>;
  };

  if (!kind || !KINDS.has(kind) || !slug || !SLUG.test(slug)) return done;
  if (!sections || typeof sections !== "object") return done;

  // At most a handful per beacon: one page view does not produce fifty
  // different sections' worth of clicks, and the cap is what stops a crafted
  // body from turning one request into a hundred writes.
  const entries = Object.entries(sections).slice(0, 20);

  await Promise.all(
    entries.map(async ([sectionId, count]) => {
      if (!SECTION_ID.test(sectionId)) return;
      const n = Math.floor(Number(count));
      // Dropped, not clamped. Clamping turned "99999 clicks" into a silent
      // +50 — the ceiling has to reject an implausible number, not round it
      // down to the largest plausible one, or the ceiling is just a tariff.
      // 20 because one visit to one section does not produce more presses
      // than that, and this endpoint has no sign-in to vouch for the caller.
      if (!Number.isFinite(n) || n < 1 || n > MAX_PER_SECTION) return;
      try {
        await supabaseRest("rpc/page_section_click", {
          method: "POST",
          returning: false,
          body: JSON.stringify({ p_kind: kind, p_slug: slug, p_section: sectionId, p_count: n }),
        });
      } catch (err) {
        // A lost click is a lost row in a report. It is not worth a 500 to
        // somebody who is in the middle of navigating.
        console.error("[page-clicks] could not record", err);
      }
    })
  );

  return done;
}
