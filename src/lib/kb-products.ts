// Product knowledge for the assistant, built from the catalogue the
// storefront itself renders (src/data/products.generated.ts, written from
// Shopify at build time — see api/webhooks/shopify, which triggers a rebuild
// when a product changes).
//
// Reading the built catalogue rather than calling Shopify here is deliberate:
// it is exactly what the product page shows the customer, so the assistant
// cannot describe a product differently from the page the customer is looking
// at. A run only rewrites articles whose text actually changed, so the daily
// sync costs almost nothing once it has caught up.
import { products } from "@/data/products";
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { KB_COLUMNS, reindexArticle, type KbArticle } from "@/lib/kb";

const REF_PREFIX = "product:";

/** What a customer might ask about a product, in the order they ask it. */
export function productArticleBody(p: (typeof products)[number]): string {
  const sizes = p.variants
    .filter((v) => v.price)
    .map((v) => `- ${v.size || "ขนาดมาตรฐาน"}: ฿${v.price}${v.inStock ? "" : " (สินค้าหมด)"}`)
    .join("\n");

  return [
    `${p.name} · แบรนด์ ${p.brand}`,
    p.shortDesc,
    p.benefits.length > 0 ? `คุณสมบัติ\n${p.benefits.map((b) => `- ${b}`).join("\n")}` : "",
    p.whoFor ? `เหมาะกับใคร\n${p.whoFor}` : "",
    p.howToUse ? `วิธีใช้\n${p.howToUse}` : "",
    p.ingredients ? `ส่วนผสม\n${p.ingredients}` : "",
    sizes ? `ขนาดและราคา\n${sizes}` : `ราคา ฿${p.price}`,
    `ดูสินค้าได้ที่ /product/${p.slug}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Products with something to say — a name and a price alone is not knowledge. */
function worthSyncing() {
  return products.filter((p) => p.benefits.length > 0 || p.howToUse.trim() || p.ingredients.trim() || p.whoFor.trim() || p.shortDesc.trim());
}

export type ProductSyncResult = {
  created: number;
  updated: number;
  unchanged: number;
  archived: number;
  total: number;
  /** Where the next slice starts, or null when the catalogue is done. */
  nextOffset: number | null;
};

/** A slice small enough to finish well inside a serverless request. */
const BATCH = 120;

/**
 * Bring the product articles in line with the catalogue: add what is new,
 * rewrite what changed, and archive the articles of products that are gone
 * (archived rather than deleted — the AI log may still point at them).
 */
export async function syncProductArticles(offset = 0, batch = BATCH): Promise<ProductSyncResult> {
  // The first run has hundreds of products to write; done in slices, each one
  // finishes long before any request timeout, and the caller walks the rest.
  const all = worthSyncing();
  const catalogue = all.slice(offset, offset + batch);
  const existing = await supabaseRest<Pick<KbArticle, "id" | "title" | "content" | "source_ref" | "status">[]>(
    `kb_articles?source=eq.shopify_sync&select=id,title,content,source_ref,status&limit=2000`
  );
  const bySlug = new Map(existing.filter((a) => a.source_ref?.startsWith(REF_PREFIX)).map((a) => [a.source_ref!.slice(REF_PREFIX.length), a]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const product of catalogue) {
    const content = productArticleBody(product);
    const current = bySlug.get(product.slug);

    if (!current) {
      const [article] = await supabaseRest<KbArticle[]>(`kb_articles?select=${KB_COLUMNS}`, {
        method: "POST",
        body: JSON.stringify({
          title: product.name,
          content,
          category: "product",
          // The product page already says all of this in public; there is
          // nothing here for a person to approve that the shop has not
          // published already.
          status: "published",
          source: "shopify_sync",
          source_ref: `${REF_PREFIX}${product.slug}`,
          product_tags: [product.slug],
          last_reviewed_at: new Date().toISOString(),
          reviewed_by: "shopify_sync",
        }),
      });
      await reindexArticle(article);
      created += 1;
      continue;
    }

    if (current.content === content && current.title === product.name && current.status !== "archived") {
      unchanged += 1;
      continue;
    }

    const [article] = await supabaseRest<KbArticle[]>(`kb_articles?id=eq.${pgValue(current.id)}&select=${KB_COLUMNS}`, {
      method: "PATCH",
      body: JSON.stringify({ title: product.name, content, status: "published", last_reviewed_at: new Date().toISOString() }),
    });
    await reindexArticle(article);
    updated += 1;
  }

  const done = offset + batch >= all.length;
  if (!done) return { created, updated, unchanged, archived: 0, total: all.length, nextOffset: offset + batch };

  // Only on the last slice, and against the whole catalogue: gone from the
  // shop means stop answering from it, but keep it readable — the AI log may
  // still point at it.
  const live = new Set(all.map((p) => p.slug));
  const stale = [...bySlug.entries()].filter(([slug, a]) => !live.has(slug) && a.status !== "archived");
  for (const [, article] of stale) {
    await supabaseRest(`kb_articles?id=eq.${pgValue(article.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "archived" }),
    });
  }

  return { created, updated, unchanged, archived: stale.length, total: all.length, nextOffset: null };
}

/** When the product articles were last written, for the admin screen. */
export async function lastProductSyncAt(): Promise<string | null> {
  const [row] = await supabaseRest<{ updated_at: string }[]>(
    "kb_articles?source=eq.shopify_sync&select=updated_at&order=updated_at.desc&limit=1"
  );
  return row?.updated_at ?? null;
}

/**
 * Articles whose chunks have no embedding yet — everything written before an
 * embedding provider was configured. Reindexing rewrites them with one, so the
 * search quietly upgrades itself instead of waiting for someone to press a
 * button in an admin screen they may never open.
 */
export async function backfillEmbeddings(budgetMs = 60_000): Promise<{ indexed: number; remaining: number }> {
  if (!process.env.VOYAGE_API_KEY) return { indexed: 0, remaining: 0 };

  const pending = await supabaseRest<{ article_id: string }[]>(
    "kb_chunks?embedding=is.null&select=article_id&limit=2000"
  ).catch((): { article_id: string }[] => []);
  const ids = [...new Set(pending.map((c) => c.article_id))];
  if (ids.length === 0) return { indexed: 0, remaining: 0 };

  const started = Date.now();
  let indexed = 0;
  for (const id of ids) {
    if (Date.now() - started > budgetMs) break;
    const [article] = await supabaseRest<Pick<KbArticle, "id" | "title" | "content">[]>(
      `kb_articles?id=eq.${pgValue(id)}&select=id,title,content`
    );
    if (!article) continue;
    await reindexArticle(article);
    indexed += 1;
  }
  return { indexed, remaining: Math.max(0, ids.length - indexed) };
}
