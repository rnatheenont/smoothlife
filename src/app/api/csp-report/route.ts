import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { isRateLimited, clientIp } from "@/lib/rate-limit";

// Collects Content-Security-Policy-Report-Only violations (see next.config.mjs)
// so the policy can be tightened from real traffic before it is enforced.
//
// Browsers send two shapes: the legacy `report-uri` body
// ({"csp-report": {...}}, application/csp-report) and the Reporting API batch
// ([{type: "csp-violation", body: {...}}], application/reports+json).
//
// Only what's needed to fix the policy is kept: the directive, the blocked
// resource's origin (never its full URL — signed storage links and OAuth
// callbacks carry tokens in the query string), the page path without its
// query, the offending script's origin and path with its line number, and
// which environment reported it. Repeats collapse into a counter.
//
// The last two exist because "blocked: eval" names no culprit, and because
// preview deployments post here too — so counting production separately is
// the only way to tell whether the live site has stopped violating.

const MAX_BODY_BYTES = 16_000;

type Violation = { directive: string; blocked: string; page: string; sample: string | null; source: string | null };

function originOf(value: unknown): string {
  if (typeof value !== "string" || !value) return "(none)";
  // Keywords the browser reports instead of a URL: inline, eval, data, blob…
  if (!/^https?:\/\//i.test(value)) return value.split(":")[0].slice(0, 40);
  try {
    return new URL(value).origin;
  } catch {
    return "(invalid)";
  }
}

/** Which script did it — origin and path, never the query string, which on
 *  a signed storage URL or an OAuth callback carries a token. */
function sourceOf(value: unknown, line: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  let where: string;
  try {
    const u = new URL(value);
    where = `${u.origin}${u.pathname}`;
  } catch {
    where = value.split("?")[0].slice(0, 200);
  }
  const n = typeof line === "number" ? line : Number(line);
  return Number.isFinite(n) && n > 0 ? `${where}:${n}` : where;
}

function pathOf(value: unknown): string {
  if (typeof value !== "string") return "(unknown)";
  try {
    return new URL(value).pathname;
  } catch {
    return "(unknown)";
  }
}

function fromLegacy(r: Record<string, unknown>): Violation {
  return {
    directive: String(r["effective-directive"] ?? r["violated-directive"] ?? "unknown").split(" ")[0],
    blocked: originOf(r["blocked-uri"]),
    page: pathOf(r["document-uri"]),
    sample: typeof r["script-sample"] === "string" && r["script-sample"] ? String(r["script-sample"]) : null,
    source: sourceOf(r["source-file"], r["line-number"]),
  };
}

function fromReportingApi(b: Record<string, unknown>): Violation {
  return {
    directive: String(b.effectiveDirective ?? "unknown").split(" ")[0],
    blocked: originOf(b.blockedURL),
    page: pathOf(b.documentURL),
    sample: typeof b.sample === "string" && b.sample ? b.sample : null,
    source: sourceOf(b.sourceFile, b.lineNumber),
  };
}

export async function POST(req: NextRequest) {
  // Reports are fire-and-forget from the browser; always answer quickly and
  // never with an error the page would care about.
  const done = new NextResponse(null, { status: 204 });
  if (!supabaseConfigured()) return done;
  if (isRateLimited(`csp:${clientIp(req)}`, 60, 60_000)) return done;

  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) return done;

  let violations: Violation[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      violations = parsed
        .filter((r) => r?.type === "csp-violation" && r.body && typeof r.body === "object")
        .map((r) => fromReportingApi(r.body));
    } else if (parsed?.["csp-report"]) {
      violations = [fromLegacy(parsed["csp-report"])];
    }
  } catch {
    return done;
  }

  await Promise.all(
    violations.slice(0, 20).map((v) =>
      supabaseRest("rpc/record_csp_report", {
        method: "POST",
        returning: false,
        body: JSON.stringify({
          p_directive: v.directive,
          p_blocked: v.blocked,
          p_page: v.page,
          p_sample: v.sample,
          p_source: v.source,
          // Preview deployments report here too. Without this the question
          // "has production stopped violating?" cannot be asked at all.
          p_env: process.env.VERCEL_ENV || "development",
        }),
      }).catch(() => {})
    )
  );
  return done;
}
