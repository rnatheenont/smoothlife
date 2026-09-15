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
// callbacks carry tokens in the query string) and the page path without its
// query. Repeats collapse into a counter in the database.

const MAX_BODY_BYTES = 16_000;

type Violation = { directive: string; blocked: string; page: string; sample: string | null };

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
  };
}

function fromReportingApi(b: Record<string, unknown>): Violation {
  return {
    directive: String(b.effectiveDirective ?? "unknown").split(" ")[0],
    blocked: originOf(b.blockedURL),
    page: pathOf(b.documentURL),
    sample: typeof b.sample === "string" && b.sample ? b.sample : null,
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
        body: JSON.stringify({ p_directive: v.directive, p_blocked: v.blocked, p_page: v.page, p_sample: v.sample }),
      }).catch(() => {})
    )
  );
  return done;
}
