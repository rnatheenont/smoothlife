import { notFound } from "next/navigation";
import { articles, getArticleBySlug } from "@/data/articles";
import { getStoreArticle, getStoreArticles } from "@/lib/storefront-articles";
import { withSeoOverride, shareMeta } from "@/lib/seo-overrides";
import ArticleView, { ARTICLE_RAIL_DEFAULT } from "@/components/knowledge/ArticleView";
import { PAGES_WAVE3_ENABLED } from "@/lib/feature-flags";
import { TemplateBody } from "@/lib/pages/template-page";

// Shopify blog posts come and go without a deploy, so any slug may be one;
// pages rebuild from the feed at most every 30 minutes.
export const revalidate = 1800;

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const a = getArticleBySlug(params.slug);
  if (a) {
    const meta = await withSeoOverride("article", a.slug, {
      title: `${a.title} | Smoothlife.com`,
      description: a.excerpt,
      image: a.image,
    });
    // withSeoOverride hands back `image`, which Metadata has no field for:
    // returned as it was, the picture an admin chose in SEO หน้าเว็บ went
    // nowhere, and the article had no og:/twitter: tags of its own at all —
    // so a shared link showed the site's front door.
    return {
      title: meta.title,
      description: meta.description,
      ...shareMeta({
        type: "article",
        title: meta.title,
        description: meta.description ?? a.excerpt,
        url: `/knowledge/article/${a.slug}`,
        image: meta.image,
      }),
    };
  }
  const post = await getStoreArticle(params.slug);
  if (!post) return { title: "Article | Smoothlife.com" };
  return {
    // If the team already wrote SEO fields for this post in Shopify, that is
    // the line they meant it to be found by — use it rather than rebuilding
    // one from the headline.
    title: post.seoTitle ? `${post.seoTitle} | Smoothlife.com` : `${post.title} | Smoothlife.com`,
    description: post.seoDescription ?? post.excerpt,
    // The post lives on www.smoothlife.com first; pointing search engines there
    // keeps this copy from competing with it, so it gets no override here —
    // an admin editing this page's title would just be ignored by Google.
    alternates: { canonical: post.sourceUrl },
    ...shareMeta({
      type: "article",
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt,
      image: post.image,
    }),
  };
}

/**
 * The page, from the article template when wave 3 is on and from the markup
 * below when it is not.
 *
 * Both halves draw the same ArticleView — the layout moved out of this file
 * rather than being copied into the section, because a page that exists twice
 * is a page that drifts. What the template adds is the words in the rail and
 * the ability to put something above or below the article.
 *
 * Which article it is, is settled here either way: a slug is a written guide,
 * or a Shopify post, or a 404, and the route has to answer that to know
 * whether there is a page at all.
 */
export default async function ArticlePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const guide = getArticleBySlug(params.slug);
  const post = guide ? null : await getStoreArticle(params.slug);
  if (!guide && !post) notFound();

  if (PAGES_WAVE3_ENABLED) {
    return (
      <TemplateBody
        templateKey="article"
        entity={{
          type: "article",
          handle: guide ? guide.slug : post!.handle,
          name: guide ? guide.title : post!.title,
        }}
      />
    );
  }

  const others = ((await getStoreArticles()) ?? []).filter((a) => a.handle !== post?.handle).slice(0, 4);
  return (
    <div className="container-page py-6 md:py-10">
      <ArticleView guide={guide} post={post} others={others} rail={ARTICLE_RAIL_DEFAULT} />
    </div>
  );
}
