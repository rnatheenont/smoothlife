import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { kbDraftChanged } from "@/lib/faq-changed";
import { supabaseConfigured, supabaseRest, pgValue, productPageTags } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { CHUNK_COLUMNS, reindexArticle, type ChunkableRow } from "@/lib/kb";
import { getProductBySlug } from "@/data/products";
import { checkItem, canPublish } from "@/lib/faq-import/check";

// Answering one, and optionally keeping the answer.
//
// The second half is the point. A question asked on a product page is a
// question the next person will also ask, and answering it only there means
// writing it again every time. The tick box turns it into a draft FAQ filed
// against that product — a draft, because an answer good enough for one
// customer in a thread is not automatically one the shop wants to publish.
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบคำถามนี้" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { answer?: unknown; alsoFaq?: unknown } | null;
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  if (!answer) return NextResponse.json({ ok: false, error: "กรุณาพิมพ์คำตอบ" }, { status: 400 });

  const [question] = await supabaseRest<{ id: string; product_slug: string; question: string }[]>(
    `product_questions?id=eq.${pgValue(id)}&select=id,product_slug,question&limit=1`
  );
  if (!question) return NextResponse.json({ ok: false, error: "ไม่พบคำถามนี้" }, { status: 404 });

  await supabaseRest(`product_questions?id=eq.${pgValue(id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ answer, answered_at: new Date().toISOString() }),
  });

  // The product page caches its questions, so the person who asked sees the
  // reply without waiting for the next deploy.
  for (const tag of productPageTags(question.product_slug)) revalidateTag(tag, { expire: 0 });

  let articleId: string | null = null;
  if (body?.alsoFaq === true) {
    const product = getProductBySlug(question.product_slug);
    const item = {
      question_th: question.question,
      answer_th: answer,
      product_slugs: product?.inStock ? [question.product_slug] : [],
    };

    // The same rules the import and the editor use. An answer typed in a
    // hurry for one customer is exactly where a price or a medical claim
    // slips in, and this is the moment it would become a shop-wide answer.
    const issues = checkItem(item, {
      productStatus: (slug) => {
        const p = getProductBySlug(slug);
        return { exists: Boolean(p), buyable: Boolean(p?.inStock) };
      },
    });

    if (!canPublish(issues)) {
      return NextResponse.json({
        ok: true,
        answered: true,
        savedAsFaq: false,
        // Answered either way: the customer's reply is not held hostage to
        // the FAQ copy failing a check.
        error: `ตอบลูกค้าแล้ว แต่ยังเก็บเป็น FAQ ไม่ได้: ${issues.find((i) => i.level === "block")!.message}`,
      });
    }

    const [article] = await supabaseRest<ChunkableRow[]>(`kb_articles?select=${CHUNK_COLUMNS}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([
        {
          source: "product_question",
          source_ref: `pq:${question.id}`,
          category: "faq",
          status: "draft",
          visibility: "public",
          title: question.question,
          content: answer,
          keywords: [question.question],
          product_tags: item.product_slugs,
        },
      ]),
    });
    await reindexArticle(article);
    articleId = article.id;
    // Saved as a draft FAQ: nothing public changed until somebody publishes it.
    kbDraftChanged();
  }

  return NextResponse.json({ ok: true, answered: true, savedAsFaq: Boolean(articleId), articleId });
}
