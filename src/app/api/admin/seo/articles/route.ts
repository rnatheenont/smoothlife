import { NextResponse } from "next/server";
import { articles } from "@/data/articles";
import { getStoreArticles, storeArticleHref } from "@/lib/storefront-articles";

// Everything the SEO screen's "บทความ" tab can edit: the guides written in
// this repository, and the blog posts the team publishes in Shopify.
//
// The Shopify ones carry whatever SEO title and description were typed into
// Shopify's own editor, so the screen shows what is already live there as the
// current value instead of pretending the page has none.
export const dynamic = "force-dynamic";

export type SeoArticleItem = {
  key: string;
  label: string;
  sub: string | null;
  image: string | null;
  href: string;
  autoTitle: string;
  autoDescription: string | null;
  fromShopify: boolean;
  /** Shopify already carries a hand-written search listing for this post. */
  written: boolean;
  /** Where a change to this page's listing has to be made. A Shopify post is
   *  canonicalised to www.smoothlife.com (see the article route), so Google
   *  reads the Shopify page's own title — an override typed here would show
   *  in the browser tab and nowhere else. */
  editableHere: boolean;
  context: string;
};

export async function GET() {
  const guides: SeoArticleItem[] = articles.map((a) => ({
    key: a.slug,
    label: a.title,
    sub: "บทความในเว็บ",
    image: a.image ?? null,
    href: `/knowledge/article/${a.slug}`,
    autoTitle: `${a.title} | Smoothlife.com`,
    autoDescription: a.excerpt ?? null,
    fromShopify: false,
    written: false,
    editableHere: true,
    context: `บทความความรู้: ${a.title}\nเกริ่นนำ: ${a.excerpt ?? ""}`,
  }));

  const posts = (await getStoreArticles()) ?? [];
  const fromShopify: SeoArticleItem[] = posts.map((p) => ({
    key: p.handle,
    label: p.title,
    sub: p.seoTitle || p.seoDescription ? "Shopify · ตั้ง SEO ไว้แล้ว" : "Shopify · ยังไม่ได้ตั้ง SEO",
    image: p.image,
    href: storeArticleHref(p),
    // What the page says today: Shopify's own SEO fields when the team filled
    // them in, the headline otherwise.
    autoTitle: p.seoTitle ? `${p.seoTitle} | Smoothlife.com` : `${p.title} | Smoothlife.com`,
    autoDescription: p.seoDescription ?? p.excerpt ?? null,
    fromShopify: true,
    written: Boolean(p.seoTitle || p.seoDescription),
    editableHere: false,
    context: `บทความบล็อกจาก Shopify: ${p.title}\nเกริ่นนำ: ${(p.excerpt ?? "").slice(0, 600)}`,
  }));

  return NextResponse.json({ ok: true, articles: [...guides, ...fromShopify] });
}
