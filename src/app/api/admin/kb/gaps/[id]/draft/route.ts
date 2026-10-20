import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { CHUNK_COLUMNS, reindexArticle, searchKb, type ChunkableRow } from "@/lib/kb";
import { getProductBySlug } from "@/data/products";
import { checkItem, warnings } from "@/lib/faq-import/check";
import { slugifyEn } from "@/lib/faq-import/parse";

// Draft an answer to a question nobody has answered.
//
// A draft, always, and the route cannot be asked for anything else. The model
// writes well enough that a published answer would read as if a person had
// approved it, and nobody would. What it produces is a starting point for
// whoever does.
//
// It is also told to write only from what it is given — the shop's existing
// answers and the real catalogue — because the failure that matters here is
// not a clumsy sentence, it is a confident one about a product that does not
// exist or a policy nobody agreed to.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const unauthorized = () => NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });

const SYSTEM = `คุณกำลังร่างคำตอบ FAQ ให้ร้าน Smoothlife.com เป็นภาษาไทย

กติกา
- ใช้ได้เฉพาะข้อมูลที่ให้มาเท่านั้น ห้ามเพิ่มนโยบาย ตัวเลข หรือสรรพคุณที่ไม่มีในข้อมูล
- ห้ามใส่ราคาในคำตอบ ราคาจะแสดงจากการ์ดสินค้าเอง
- แนะนำได้เฉพาะสินค้าที่อยู่ในรายการสินค้าจริงที่ให้มา ใช้ slug ตรงตามที่ให้
- ห้ามเขียนว่า รักษา หายขาด ป้องกันโรค หรือรับรองผล — ร้านขายเครื่องสำอางและอาหารเสริม
- ถ้าอาการอาจรุนแรงหรือเรื้อรัง ให้เติมประโยคแนะนำให้ปรึกษาแพทย์หรือเภสัชกร
- ประโยคแรกต้องตอบคำถามให้จบ แล้วค่อยขยาย ความยาวรวมไม่เกิน 4 ประโยค
- ถ้าข้อมูลที่ให้มาไม่พอจะตอบ ให้ตอบ {"insufficient": true}

ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่นประกอบ:
{"question_th": "...", "answer_th": "...", "question_en": "...", "answer_en": "...", "keywords": ["..."], "product_slugs": ["..."]}`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" }, { status: 400 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบคำถามนี้" }, { status: 400 });

  const [gap] = await supabaseRest<{ id: string; question: string; examples: string[] | null }[]>(
    `kb_gaps?id=eq.${pgValue(id)}&select=id,question,examples&limit=1`
  );
  if (!gap) return NextResponse.json({ ok: false, error: "ไม่พบคำถามนี้" }, { status: 404 });

  // What the shop already says, so the draft agrees with it rather than
  // inventing a second version of the same policy.
  const nearby = await searchKb(gap.question, 5).catch(() => []);
  const context = nearby.map((m, i) => `[${i + 1}] ${m.title}\n${m.chunk_text}`).join("\n\n");

  // The catalogue the draft is allowed to name. Taken from the articles the
  // search just returned, so it is products this shop actually recommends for
  // this kind of question — not the whole shop, which would invite the model
  // to pick whatever sounded right.
  const nearbyIds = [...new Set(nearby.map((m) => m.article_id))];
  const tagged = nearbyIds.length
    ? await supabaseRest<{ product_tags: string[] | null }[]>(
        `kb_articles?id=in.(${nearbyIds.map(pgValue).join(",")})&select=product_tags`
      ).catch((): { product_tags: string[] | null }[] => [])
    : [];
  const slugs = [...new Set(tagged.flatMap((a) => a.product_tags ?? []))];
  const products = slugs
    .map((s) => getProductBySlug(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && Boolean(p?.inStock))
    .slice(0, 12)
    .map((p) => `- ${p.slug} — ${p.name} (${p.brand})`)
    .join("\n");

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              `คำถามที่ลูกค้าถามแล้วเรายังไม่มีคำตอบ:\n${gap.question}`,
              gap.examples?.length ? `\nถ้อยคำที่ลูกค้าพิมพ์จริง:\n${gap.examples.map((e) => `- ${e}`).join("\n")}` : "",
              context ? `\nคำตอบที่ร้านมีอยู่แล้ว (ใช้เป็นแหล่งเดียว):\n${context}` : "\n(ยังไม่มีคำตอบใกล้เคียงในคลัง)",
              products ? `\nสินค้าจริงที่แนะนำได้ (ใช้ slug ตรงตามนี้):\n${products}` : "\n(ไม่มีสินค้าที่เกี่ยวข้อง — อย่าแนะนำสินค้า)",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      }),
    });
  } catch (err) {
    console.error("[kb/gaps/draft] request failed", err);
    return NextResponse.json({ ok: false, error: "เรียก AI ไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
  }

  if (!res.ok) {
    console.error("[kb/gaps/draft] anthropic error", res.status, (await res.text()).slice(0, 300));
    return NextResponse.json({ ok: false, error: "AI ตอบกลับไม่สำเร็จ" }, { status: 502 });
  }

  const payload = (await res.json()) as { content?: { type: string; text?: string }[] };
  const raw = (payload.content ?? []).find((c) => c.type === "text")?.text ?? "";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);

  let drafted: Record<string, unknown>;
  try {
    drafted = JSON.parse(json);
  } catch {
    return NextResponse.json({ ok: false, error: "AI ตอบกลับในรูปแบบที่อ่านไม่ได้ ลองใหม่อีกครั้ง" }, { status: 502 });
  }
  if (drafted.insufficient) {
    return NextResponse.json(
      { ok: false, error: "ข้อมูลที่มีอยู่ไม่พอจะร่างคำตอบ — เขียนเองหรือเพิ่มข้อมูลสินค้าก่อน" },
      { status: 422 }
    );
  }

  const str = (k: string) => (typeof drafted[k] === "string" ? (drafted[k] as string).trim() : "");
  const arr = (k: string) =>
    Array.isArray(drafted[k]) ? (drafted[k] as unknown[]).filter((x): x is string => typeof x === "string") : [];

  // Checked, not trusted. The model was told which products exist; a slug it
  // invented anyway must not reach an article, because the FAQ page would
  // then render a card for a product nobody can buy.
  const picked = arr("product_slugs").filter((s) => slugs.includes(s) && getProductBySlug(s));

  const item = {
    question_th: str("question_th") || gap.question,
    answer_th: str("answer_th"),
    question_en: str("question_en") || null,
    answer_en: str("answer_en") || null,
    product_slugs: picked,
  };

  const issues = checkItem(item, {
    productStatus: (slug) => {
      const p = getProductBySlug(slug);
      return { exists: Boolean(p), buyable: Boolean(p?.inStock) };
    },
  });
  if (issues.some((i) => i.level === "block")) {
    return NextResponse.json(
      { ok: false, error: `ร่างที่ได้ยังใช้ไม่ได้: ${issues.find((i) => i.level === "block")!.message}` },
      { status: 422 }
    );
  }

  const [article] = await supabaseRest<ChunkableRow[]>(`kb_articles?select=${CHUNK_COLUMNS}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([
      {
        source: "ai_draft",
        source_ref: `gap:${gap.id}`,
        category: "faq",
        status: "draft",
        visibility: "public",
        title: item.question_th,
        content: item.answer_th,
        title_en: item.question_en,
        content_en: item.answer_en,
        keywords: [...new Set([gap.question, ...(gap.examples ?? []), ...arr("keywords")])].slice(0, 40),
        product_tags: picked,
        public_slug: item.question_en ? slugifyEn(item.question_en) : null,
      },
    ]),
  });

  await reindexArticle(article);
  await supabaseRest(`kb_gaps?id=eq.${pgValue(id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "drafted", article_id: article.id }),
  });

  revalidateTag("kb-public", { expire: 0 });

  return NextResponse.json({
    ok: true,
    articleId: article.id,
    // Shown next to the draft, so whoever reads it starts with what the
    // checks already noticed rather than finding it at publish time.
    warnings: warnings(issues).map((i) => i.message),
  });
}
