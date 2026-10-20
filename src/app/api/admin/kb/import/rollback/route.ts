import { NextRequest, NextResponse } from "next/server";
import { faqChanged } from "@/lib/faq-changed";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { CHUNK_COLUMNS, reindexArticle, type ChunkableRow } from "@/lib/kb";

// Undoing an import.
//
// Not "delete what it made": most of a re-import is updates, and deleting
// those would throw away answers that existed before anybody imported
// anything. The batch recorded, per article, whether it created it or
// updated it and what the updated ones held before — this puts that back.
//
// The batch id arrives in the body rather than the path. The permission map
// matches on path prefixes, and /api/admin/kb/import/<id>/rollback would be
// matched by the rule for /api/admin/kb/import, which is kb.draft. Undoing
// deletes rows and overwrites others, so it needs kb.publish, and the only
// way a prefix can say that is if the path is fixed.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

type UndoEntry = { id: string; action: "created" | "updated"; before?: Record<string, unknown> };

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { batchId?: unknown } | null;
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) {
    return NextResponse.json({ ok: false, error: "ไม่พบรหัสการนำเข้า" }, { status: 400 });
  }

  const [batch] = await supabaseRest<{ id: string; undo: UndoEntry[]; rolled_back_at: string | null }[]>(
    `kb_import_batches?id=eq.${pgValue(batchId)}&select=id,undo,rolled_back_at&limit=1`
  );
  if (!batch) return NextResponse.json({ ok: false, error: "ไม่พบการนำเข้านี้" }, { status: 404 });
  if (batch.rolled_back_at) {
    return NextResponse.json({ ok: false, error: "การนำเข้านี้ถูกย้อนกลับไปแล้ว" }, { status: 409 });
  }

  const undo = Array.isArray(batch.undo) ? batch.undo : [];
  if (undo.length === 0) {
    return NextResponse.json({ ok: false, error: "การนำเข้านี้ไม่ได้บันทึกค่าก่อนแก้ไว้ จึงย้อนกลับให้ไม่ได้" }, { status: 409 });
  }

  const createdIds = undo.filter((u) => u.action === "created").map((u) => u.id);
  const updates = undo.filter((u) => u.action === "updated" && u.before);

  let deleted = 0;
  let restored = 0;
  const failed: string[] = [];

  // Published answers are left alone, whichever way they got there. Somebody
  // read one and decided it was fit to face a customer after this import
  // created it; silently deleting it because the import is being undone
  // would take that decision away without telling anyone.
  const published = createdIds.length
    ? await supabaseRest<{ id: string }[]>(
        `kb_articles?id=in.(${createdIds.map(pgValue).join(",")})&status=eq.published&select=id`
      )
    : [];
  const keep = new Set(published.map((p) => p.id));

  const removable = createdIds.filter((id) => !keep.has(id));
  if (removable.length > 0) {
    await supabaseRest(`kb_chunks?article_id=in.(${removable.map(pgValue).join(",")})`, {
      method: "DELETE",
      returning: false,
    });
    await supabaseRest(`kb_articles?id=in.(${removable.map(pgValue).join(",")})`, {
      method: "DELETE",
      returning: false,
    });
    deleted = removable.length;
  }

  for (const u of updates) {
    try {
      const [row] = await supabaseRest<ChunkableRow[]>(`kb_articles?id=eq.${pgValue(u.id)}&select=${CHUNK_COLUMNS}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(u.before),
      });
      if (row) {
        await reindexArticle(row);
        restored++;
      }
    } catch (err) {
      console.error("[kb/import] restoring an article failed", u.id, err);
      failed.push(u.id);
    }
  }

  await supabaseRest(`kb_import_batches?id=eq.${pgValue(batchId)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ rolled_back_at: new Date().toISOString() }),
  });

  faqChanged();

  return NextResponse.json({
    ok: true,
    deleted,
    restored,
    keptPublished: keep.size,
    failed,
  });
}
