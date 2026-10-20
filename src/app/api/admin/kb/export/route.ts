import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { CSV_COLUMNS } from "@/lib/faq-import/parse";

// Taking the answers back out.
//
// Two jobs in one route: a backup, and a round trip through a spreadsheet so
// the content team can edit thirty answers at once and import them back. The
// second is why the CSV columns are exactly the ones the importer reads —
// exporting a shape that cannot be imported would be a file that looks like
// a working loop and is not.
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

type Row = {
  source_ref: string | null;
  topic: string | null;
  concerns: string[] | null;
  brand_slugs: string[] | null;
  title: string;
  content: string;
  title_en: string | null;
  content_en: string | null;
  keywords: string[] | null;
  product_tags: string[] | null;
  cta_label: string | null;
  cta_href: string | null;
  visibility: string | null;
  pinned: boolean | null;
  public_slug: string | null;
  status: string;
  updated_at: string;
};

const COLUMNS =
  "source_ref,topic,concerns,brand_slugs,title,content,title_en,content_en,keywords,product_tags,cta_label,cta_href,visibility,pinned,public_slug,status,updated_at";

/**
 * One CSV field.
 *
 * Always quoted, rather than only when it contains a comma. The answers are
 * Thai prose with commas and quotation marks in them, and a rule that only
 * sometimes quotes is a rule somebody will later find a gap in — this way the
 * output is the same shape for every field and the reader does not care.
 *
 * The leading apostrophe on =, +, - and @ is for spreadsheets: a cell that
 * starts with one of those is a formula, and an answer beginning "=" would be
 * executed by Excel when the content team opens the file.
 */
function csvField(value: unknown): string {
  const many = Array.isArray(value) ? value.join("|") : value;
  const s = many === null || many === undefined ? "" : String(many);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const params = req.nextUrl.searchParams;
  const format = params.get("format") === "json" ? "json" : "csv";
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s));

  const filter = ids.length > 0 ? `&id=in.(${ids.map((i) => `"${i}"`).join(",")})` : "";
  const rows = await supabaseRest<Row[]>(
    `kb_articles?select=${COLUMNS}${filter}&order=source_ref.asc.nullslast,updated_at.desc&limit=2000`
  );

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const items = rows.map((r) => ({
      source_ref: r.source_ref,
      topic: r.topic,
      concerns: r.concerns ?? [],
      brands: r.brand_slugs ?? [],
      question_th: r.title,
      answer_th: r.content,
      question_en: r.title_en,
      answer_en: r.content_en,
      keywords: r.keywords ?? [],
      product_slugs: r.product_tags ?? [],
      cta_label: r.cta_label,
      cta_href: r.cta_href,
      visibility: r.visibility,
      pinned: Boolean(r.pinned),
      public_slug: r.public_slug,
      status: r.status,
    }));
    return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), items }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="faq-${stamp}.json"`,
      },
    });
  }

  const header = CSV_COLUMNS.join(",");
  const body = rows
    .map((r) =>
      [
        r.source_ref,
        r.topic,
        r.concerns,
        r.brand_slugs,
        r.title,
        r.content,
        r.title_en,
        r.content_en,
        r.keywords,
        r.product_tags,
        r.cta_label,
        r.cta_href,
        r.visibility,
        r.pinned ? "true" : "false",
      ]
        .map(csvField)
        .join(",")
    )
    .join("\n");

  // The BOM is what makes Excel on Windows read this as UTF-8. Without it
  // every Thai answer opens as mojibake, which looks like the export is
  // broken rather than the spreadsheet guessing wrong.
  return new NextResponse(`﻿${header}\n${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="faq-${stamp}.csv"`,
    },
  });
}
