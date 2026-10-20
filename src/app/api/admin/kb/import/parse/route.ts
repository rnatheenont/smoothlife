import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { getProductBySlug } from "@/data/products";
import { parseImport, type ImportFormat } from "@/lib/faq-import/parse";
import { buildPreview, previewCounts, type ComparableArticle, type ExistingArticle } from "@/lib/faq-import/preview";
import { fetchSource, SourceError } from "@/lib/faq-import/source";

// Step two of an import: say what would happen, and write nothing.
//
// Separate from the commit on purpose. The preview is where a person decides,
// and a route that previewed and wrote in one call would make that decision
// unavailable — which is how an import quietly creates a second copy of a
// question the shop already answers.
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

/** Everything the preview compares against, for every imported article. */
const EXISTING_COLUMNS =
  "id,source_ref,title,public_slug,status,updated_at,content,title_en,content_en,keywords,topic,concerns,brand_slugs,product_tags,cta_label,cta_href";

type ExistingRow = ExistingArticle & {
  content: string;
  title_en: string | null;
  content_en: string | null;
  keywords: string[] | null;
  topic: string | null;
  concerns: string[] | null;
  brand_slugs: string[] | null;
  product_tags: string[] | null;
  cta_label: string | null;
  cta_href: string | null;
};

/** The stored article in the same shape the parsed item uses, for the diff. */
function comparable(row: ExistingRow): ComparableArticle {
  return {
    question_th: row.title,
    answer_th: row.content,
    question_en: row.title_en,
    answer_en: row.content_en,
    keywords: row.keywords ?? [],
    topic: row.topic,
    concerns: row.concerns ?? [],
    brands: row.brand_slugs ?? [],
    product_slugs: row.product_tags ?? [],
    cta_label: row.cta_label,
    cta_href: row.cta_href,
  };
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as {
    text?: unknown;
    url?: unknown;
    format?: unknown;
  } | null;
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  let text = typeof body.text === "string" ? body.text : "";
  let fileName: string | null = null;
  let sourceUrl: string | null = null;

  if (typeof body.url === "string" && body.url.trim()) {
    try {
      const fetched = await fetchSource(body.url);
      text = fetched.text;
      fileName = fetched.fileName;
      sourceUrl = fetched.sourceUrl;
    } catch (err) {
      if (err instanceof SourceError) return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
      console.error("[kb/import] fetching the document failed", err);
      return NextResponse.json({ ok: false, error: "ดึงเอกสารไม่สำเร็จ" }, { status: 502 });
    }
  }

  if (!text.trim()) return NextResponse.json({ ok: false, error: "ยังไม่มีเนื้อหาให้นำเข้า" }, { status: 400 });

  const format = typeof body.format === "string" ? (body.format as ImportFormat) : undefined;
  let parsed;
  try {
    parsed = parseImport(text, format);
  } catch (err) {
    // A JSON file with a typo in it is the one shape that throws rather than
    // returning nothing, and the message is worth passing on.
    return NextResponse.json(
      { ok: false, error: `อ่านไฟล์ไม่สำเร็จ: ${err instanceof Error ? err.message : "รูปแบบไม่ถูกต้อง"}` },
      { status: 400 }
    );
  }

  const existing = await supabaseRest<ExistingRow[]>(
    `kb_articles?select=${EXISTING_COLUMNS}&order=updated_at.desc&limit=1000`
  );

  // When this document was last imported, so an article edited in the admin
  // since then shows as a conflict rather than being silently overwritten.
  const sameSource = sourceUrl
    ? await supabaseRest<{ created_at: string }[]>(
        `kb_import_batches?source_url=eq.${encodeURIComponent(sourceUrl)}&rolled_back_at=is.null&select=created_at&order=created_at.desc&limit=1`
      ).catch((): { created_at: string }[] => [])
    : [];

  const rows = buildPreview(parsed.items, existing, {
    current: new Map(existing.map((e) => [e.id, comparable(e)])),
    lastImportAt: sameSource[0]?.created_at ?? null,
    check: {
      productStatus: (slug) => {
        const p = getProductBySlug(slug);
        return { exists: Boolean(p), buyable: Boolean(p?.inStock) };
      },
    },
  });

  return NextResponse.json({
    ok: true,
    format: parsed.format,
    fileName,
    sourceUrl,
    skipped: parsed.skipped,
    counts: previewCounts(rows),
    rows,
  });
}
