import { NextRequest, NextResponse } from "next/server";
import { faqChanged } from "@/lib/faq-changed";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { CHUNK_COLUMNS, reindexArticle, type ChunkableRow } from "@/lib/kb";
import { checkItem, canPublish } from "@/lib/faq-import/check";
import type { ParsedItem } from "@/lib/faq-import/parse";
import { getProductBySlug } from "@/data/products";

// Step three: write the rows the person ticked.
//
// Everything lands as a draft. Publishing is a separate decision made by
// somebody with the permission to make it — importing a document is not a
// statement that the shop stands behind what the document says, which is the
// whole reason the thirty-three arrived as drafts in the first place.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

/** The columns an import writes — and so the columns an undo restores. */
const WRITTEN = [
  "title",
  "content",
  "title_en",
  "content_en",
  "keywords",
  "topic",
  "concerns",
  "brand_slugs",
  "product_tags",
  "cta_label",
  "cta_href",
  "public_slug",
  "visibility",
  "pinned",
] as const;

type UndoEntry = {
  id: string;
  action: "created" | "updated";
  before?: Record<string, unknown>;
};

function rowFor(item: ParsedItem) {
  return {
    source: "import",
    source_ref: item.source_ref,
    category: "faq",
    title: item.question_th,
    content: item.answer_th,
    title_en: item.question_en,
    content_en: item.answer_en,
    keywords: item.keywords,
    topic: item.topic,
    concerns: item.concerns,
    brand_slugs: item.brands,
    product_tags: item.product_slugs,
    cta_label: item.cta_label,
    cta_href: item.cta_href,
    public_slug: item.public_slug,
    visibility: item.visibility,
    pinned: item.pinned,
  };
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as {
    items?: unknown;
    sourceUrl?: unknown;
    fileName?: unknown;
    format?: unknown;
  } | null;
  const items = Array.isArray(body?.items) ? (body.items as ParsedItem[]) : [];
  if (items.length === 0) return NextResponse.json({ ok: false, error: "ยังไม่ได้เลือกข้อไหนเลย" }, { status: 400 });
  if (items.length > 500) return NextResponse.json({ ok: false, error: "นำเข้าได้สูงสุด 500 ข้อต่อครั้ง" }, { status: 400 });

  // Re-checked here, not trusted from the preview. The preview is a screen;
  // this is the thing that writes, and a row that cannot be published is a
  // row that should not be stored either.
  const bad = items.filter(
    (item) =>
      !canPublish(
        checkItem(item, {
          productStatus: (slug) => {
            const p = getProductBySlug(slug);
            return { exists: Boolean(p), buyable: Boolean(p?.inStock) };
          },
        })
      )
  );
  if (bad.length > 0) {
    return NextResponse.json(
      { ok: false, error: `มี ${bad.length} ข้อที่ยังติดปัญหาและนำเข้าไม่ได้`, refs: bad.map((b) => b.source_ref) },
      { status: 400 }
    );
  }

  const refs = items.map((i) => i.source_ref);
  const existing = await supabaseRest<({ id: string; source_ref: string } & Record<string, unknown>)[]>(
    `kb_articles?source=eq.import&source_ref=in.(${refs.map(pgValue).join(",")})&select=id,source_ref,${WRITTEN.join(",")}`
  );
  const byRef = new Map(existing.map((e) => [e.source_ref, e]));

  const [batch] = await supabaseRest<{ id: string }[]>("kb_import_batches", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([
      {
        source: typeof body?.format === "string" ? body.format : "paste",
        source_url: typeof body?.sourceUrl === "string" ? body.sourceUrl : null,
        file_name: typeof body?.fileName === "string" ? body.fileName : null,
        counts: {},
      },
    ]),
  });

  const undo: UndoEntry[] = [];
  const saved: ChunkableRow[] = [];
  let created = 0;
  let updated = 0;

  try {
    for (const item of items) {
      const match = byRef.get(item.source_ref);
      const row = rowFor(item);

      if (match) {
        // Only the fields this import writes are remembered, because they are
        // the only ones it can damage.
        const before: Record<string, unknown> = {};
        for (const f of WRITTEN) before[f] = match[f];

        // The representation asks for CHUNK_COLUMNS so the row that comes
        // back is one `reindexArticle` can actually chunk. Letting it
        // return the default shape would work today and break the day
        // somebody narrows it.
        const [one] = await supabaseRest<ChunkableRow[]>(`kb_articles?id=eq.${pgValue(match.id)}&select=${CHUNK_COLUMNS}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          // status is untouched: re-importing must never pull a published
          // answer back to draft, nor quietly republish one taken down.
          body: JSON.stringify({ ...row, import_batch_id: batch.id }),
        });
        undo.push({ id: match.id, action: "updated", before });
        saved.push(one);
        updated++;
      } else {
        const [one] = await supabaseRest<ChunkableRow[]>(`kb_articles?select=${CHUNK_COLUMNS}`, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify([{ ...row, status: "draft", import_batch_id: batch.id }]),
        });
        undo.push({ id: one.id, action: "created" });
        saved.push(one);
        created++;
      }
    }
  } catch (err) {
    // A half-written batch that claims to be whole is worse than a failure,
    // so the record of it goes away and what was written stays findable by
    // its batch id in the server log.
    console.error("[kb/import] commit failed", { batch: batch.id, written: undo.length }, err);
    await supabaseRest(`kb_import_batches?id=eq.${batch.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ counts: { created, updated, failed: true }, undo }),
    }).catch(() => {});
    return NextResponse.json(
      { ok: false, error: `เขียนไม่สำเร็จหลังทำไปแล้ว ${undo.length} ข้อ — ใช้ปุ่มย้อนกลับของ batch นี้`, batchId: batch.id },
      { status: 500 }
    );
  }

  await supabaseRest(`kb_import_batches?id=eq.${batch.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ counts: { created, updated, total: items.length }, undo }),
  });

  // Chunks now, not at 04:30 tomorrow: an imported answer the assistant
  // cannot retrieve is an answer that does not exist yet.
  let indexed = 0;
  for (const article of saved) {
    try {
      await reindexArticle(article);
      indexed++;
    } catch (err) {
      console.error("[kb/import] reindex failed", article.id, err);
    }
  }

  faqChanged(items.map((i) => i.public_slug ?? null));

  return NextResponse.json({ ok: true, batchId: batch.id, created, updated, indexed, total: items.length });
}
