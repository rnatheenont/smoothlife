import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { migrateDoc } from "@/lib/pages/doc";
import { SECTION_REGISTRY } from "@/sections/registry";
import type { PageRow } from "@/lib/pages/store";
import type { PageKind } from "@/lib/pages/types";

// How a page is doing: presses per section, by day.
//
// Reads the aggregate counter only (page_section_clicks). There is nothing
// per-person to read — the counter does not collect it — so "how many people"
// is a question this screen deliberately cannot answer, and says so rather
// than implying a number it does not have.
//
// Sections are named from the page's own draft, so a section that was
// deleted still shows its clicks under its id: the weeks it was live
// happened, and a report that drops them is a report that says the page did
// less than it did.

const KINDS: PageKind[] = ["home", "page", "campaign", "brand"];
const DAYS = 30;

export async function GET(req: NextRequest, props: { params: Promise<{ kind: string; slug: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const p = await props.params;
  const kind = KINDS.find((k) => k === p.kind);
  if (!kind) return NextResponse.json({ ok: false, error: "ไม่รู้จักประเภทเพจนี้" }, { status: 400 });

  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);
  const [rows, [page]] = await Promise.all([
    supabaseRest<{ section_id: string; day: string; clicks: number }[]>(
      `page_section_clicks?select=section_id,day,clicks` +
        `&page_kind=eq.${pgValue(kind)}&page_slug=eq.${pgValue(p.slug)}&day=gte.${since}` +
        `&order=day.desc&limit=2000`
    ),
    supabaseRest<PageRow[]>(`pages?select=*&kind=eq.${pgValue(kind)}&slug=eq.${pgValue(p.slug)}&limit=1`),
  ]);

  // Name and order from the document, so the table reads in the order the
  // sections appear on the page rather than by whichever got clicked most.
  const doc = page ? migrateDoc(page.draft_doc) : { sections: [] };
  const order = new Map<string, number>(doc.sections.map((s, i) => [s.id, i] as const));
  const labels = new Map<string, string>(
    doc.sections.map((s) => [s.id, SECTION_REGISTRY[s.type]?.label ?? s.type] as const)
  );

  const totals = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.section_id, (totals.get(row.section_id) ?? 0) + row.clicks);
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.clicks);
  }

  const sections = [...totals.entries()]
    .map(([id, clicks]) => ({
      id,
      clicks,
      label: labels.get(id) ?? null,
      // True for a section that is no longer in the draft: its clicks are
      // real history, and the screen says where they came from.
      gone: !labels.has(id),
      index: order.get(id) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.index - b.index || b.clicks - a.clicks);

  return NextResponse.json({
    ok: true,
    days: DAYS,
    title: page?.title ?? p.slug,
    status: page?.status ?? null,
    sections,
    total: [...totals.values()].reduce((n, c) => n + c, 0),
    daily: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, clicks]) => ({ day, clicks })),
  });
}
