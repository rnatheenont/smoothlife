import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

// The monthly AI check: thirty questions, five engines, filled in by hand.
//
// No API answers "does ChatGPT recommend us", so this is a form and a
// record, not a feed. The route's whole job is to keep one month's answers
// together and to let a row be corrected without creating a second one —
// which is what the (month, question, engine) key is for.
//
// Covered by the /api/admin/seo rule (seo.manage) in admin-route-permissions.
export const dynamic = "force-dynamic";

const ENGINES = ["chatgpt", "gemini", "perplexity", "copilot", "google_aio"] as const;
type Engine = (typeof ENGINES)[number];

const COLUMNS = "id,month,question,engine,cited,linked_url,competitor,note,updated_at";

type GeoCheck = {
  id: string;
  month: string;
  question: string;
  engine: Engine;
  cited: boolean | null;
  linked_url: string | null;
  competitor: string | null;
  note: string | null;
  updated_at: string;
};

const unauthorized = () =>
  NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
const unavailable = () =>
  NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

/** The first day of a month, which is how a month is stored. Anything that
 *  is not a month is rejected rather than coerced: a silently wrong month
 *  puts this check in a series it does not belong to. */
function monthStart(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(raw.trim());
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

function thisMonth(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

function text(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value ? value.slice(0, max) : null;
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return unavailable();

  const month = monthStart(req.nextUrl.searchParams.get("month")) ?? thisMonth();

  const [rows, months] = await Promise.all([
    supabaseRest<GeoCheck[]>(
      `geo_checks?month=eq.${pgValue(month)}&select=${COLUMNS}&order=question.asc,engine.asc&limit=1000`,
    ).catch((): GeoCheck[] => []),
    // Which months have anything in them, so the screen can offer them
    // rather than asking somebody to remember when they last did this.
    supabaseRest<{ month: string }[]>("geo_checks?select=month&order=month.desc&limit=1000").catch(
      (): { month: string }[] => [],
    ),
  ]);

  const checked = rows.filter((r) => r.cited !== null);
  return NextResponse.json({
    ok: true,
    month,
    engines: ENGINES,
    months: [...new Set(months.map((m) => m.month))],
    rows,
    // Out of the ones somebody has actually looked at — a question nobody
    // has checked yet is not a question we failed.
    summary: { total: rows.length, checked: checked.length, cited: checked.filter((r) => r.cited).length },
  });
}

/** Add this month's questions. Existing rows are left exactly as they are,
 *  so running it twice does not wipe what somebody already filled in. */
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return unavailable();

  const body = await req.json().catch(() => null);
  const month = monthStart(body?.month) ?? thisMonth();
  const questions: string[] = Array.isArray(body?.questions)
    ? [
        ...new Set(
          (body.questions as unknown[])
            .map((q) => text(q, 300))
            .filter((q): q is string => q !== null),
        ),
      ]
    : [];
  if (questions.length === 0)
    return NextResponse.json({ ok: false, error: "ยังไม่มีคำถาม" }, { status: 400 });
  if (questions.length > 100)
    return NextResponse.json({ ok: false, error: "ครั้งละไม่เกิน 100 คำถาม" }, { status: 400 });

  const rows = questions.flatMap((question) =>
    ENGINES.map((engine) => ({ month, question, engine })),
  );

  // ignore-duplicates, not merge: a second run this month is "add anything
  // missing", and merging would blank the answers already recorded.
  await supabaseRest("geo_checks?on_conflict=month,question,engine", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    returning: false,
    body: JSON.stringify(rows),
  });

  return NextResponse.json({ ok: true, month, added: rows.length });
}

/** Record what one engine answered for one question. */
export async function PATCH(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return unavailable();

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ ok: false, error: "ไม่พบรายการ" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  // Three states, not two: true, false, and "nobody has looked yet".
  if ("cited" in (body ?? {})) patch.cited = typeof body.cited === "boolean" ? body.cited : null;
  if ("linked_url" in (body ?? {})) patch.linked_url = text(body.linked_url, 500);
  if ("competitor" in (body ?? {})) patch.competitor = text(body.competitor, 200);
  if ("note" in (body ?? {})) patch.note = text(body.note, 1000);

  const [row] = await supabaseRest<GeoCheck[]>(
    `geo_checks?id=eq.${pgValue(id)}&select=${COLUMNS}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบรายการ" }, { status: 404 });
  return NextResponse.json({ ok: true, row });
}
