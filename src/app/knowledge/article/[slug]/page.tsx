import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { articles, getArticleBySlug } from "@/data/articles";
import { getStoreArticle, getStoreArticles, storeArticleHref, thaiDate, type StoreArticle } from "@/lib/storefront-articles";
import { BookOpen, ChevronLeft, ChevronRight, Clock, MessageCircle } from "lucide-react";

// Shopify blog posts come and go without a deploy, so any slug may be one;
// pages rebuild from the feed at most every 30 minutes.
export const revalidate = 1800;

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const a = getArticleBySlug(params.slug);
  if (a) return { title: `${a.title} | Smoothlife.com` };
  const post = await getStoreArticle(params.slug);
  if (!post) return { title: "Article | Smoothlife.com" };
  return {
    title: `${post.title} | Smoothlife.com`,
    description: post.excerpt,
    // The post lives on www.smoothlife.com first; pointing search engines there
    // keeps this copy from competing with it.
    alternates: { canonical: post.sourceUrl },
    openGraph: post.image ? { images: [post.image] } : undefined,
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const guide = getArticleBySlug(params.slug);
  const post = guide ? null : await getStoreArticle(params.slug);
  if (!guide && !post) notFound();
  const others = ((await getStoreArticles()) ?? []).filter((a) => a.handle !== post?.handle).slice(0, 4);

  if (guide) {
    return (
      <ArticleLayout title={guide.title} meta={<span>{guide.readMins} นาทีในการอ่าน</span>} image={guide.image} others={others}>
        <div className="article-body">
          {guide.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-10 rounded-xl2 bg-surface-soft p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-brand-ink">
            <BookOpen size={16} aria-hidden="true" /> แหล่งอ้างอิง
          </div>
          <ul className="list-inside list-disc space-y-1 text-xs text-slate-500">
            {guide.sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </ArticleLayout>
    );
  }

  return (
    <ArticleLayout
      title={post!.title}
      excerpt={post!.excerpt}
      meta={
        <>
          <time dateTime={post!.publishedAt}>{thaiDate(post!.publishedAt)}</time>
          <span className="flex items-center gap-1">
            <Clock size={14} aria-hidden="true" /> อ่าน {post!.readMins} นาที
          </span>
        </>
      }
      image={post!.image}
      others={others}
    >
      <div className="article-body" dangerouslySetInnerHTML={{ __html: post!.html }} />
    </ArticleLayout>
  );
}

// Phone: one column — back link, title, meta, cover, body, then other posts.
// Desktop (lg): the reading column stays ~720px wide for comfortable line
// length, and the space beside it holds a sticky rail with other posts and
// the advisor, so the page uses the width without stretching the text.
function ArticleLayout({
  title,
  excerpt,
  meta,
  image,
  others,
  children,
}: {
  title: string;
  excerpt?: string;
  meta: ReactNode;
  image: string | null;
  others: StoreArticle[];
  children: ReactNode;
}) {
  return (
    <div className="container-page py-6 md:py-10">
      <nav aria-label="breadcrumb" className="text-sm">
        <Link
          href="/knowledge"
          className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 font-medium text-brand-800 hover:bg-surface-mist lg:hidden"
        >
          <ChevronLeft size={16} aria-hidden="true" /> ความรู้เรื่องผิวและสุขภาพ
        </Link>
        <ol className="hidden items-center gap-1.5 text-slate-500 lg:flex">
          <li>
            <Link href="/" className="hover:text-brand-800">
              หน้าแรก
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight size={14} />
          </li>
          <li>
            <Link href="/knowledge" className="hover:text-brand-800">
              ความรู้เรื่องผิวและสุขภาพ
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight size={14} />
          </li>
          <li className="max-w-md truncate text-slate-700" aria-current="page">
            {title}
          </li>
        </ol>
      </nav>

      <div className="mx-auto max-w-2xl lg:mx-0 lg:mt-6 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12 xl:gap-16">
        <article className="min-w-0 lg:max-w-[720px]">
          <h1 className="mt-3 text-2xl font-extrabold leading-snug text-brand-ink md:text-4xl md:leading-tight lg:mt-0 lg:text-[2.5rem]">
            {title}
          </h1>
          {excerpt && <p className="mt-3 hidden text-lg leading-relaxed text-slate-600 lg:block">{excerpt}</p>}
          <p className="mt-3 flex items-center gap-3 text-sm text-slate-500 lg:mt-4">{meta}</p>
          {image && (
            <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-xl2 bg-surface-mist md:mt-7">
              <Image src={image} alt="" fill priority sizes="(max-width: 1024px) 100vw, 720px" className="object-cover" />
            </div>
          )}
          <div className="mt-6 md:mt-8">{children}</div>
        </article>

        <aside className="mt-12 border-t border-surface-line pt-8 lg:mt-0 lg:border-0 lg:pt-0">
          <div className="lg:sticky lg:top-40 lg:flex lg:flex-col lg:gap-6">
            {others.length > 0 && (
              <section className="lg:rounded-xl2 lg:border lg:border-surface-line lg:p-5">
                <h2 className="text-lg font-bold text-brand-ink lg:text-base">บทความอื่น</h2>
                <ul className="mt-4 flex flex-col gap-3 lg:gap-1">
                  {others.map((a) => (
                    <li key={a.handle}>
                      <Link href={storeArticleHref(a)} className="-mx-2 flex items-center gap-3 rounded-xl2 p-2 hover:bg-surface-mist">
                        <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-mist lg:h-14 lg:w-20">
                          {a.image && <Image src={a.image} alt="" fill sizes="96px" className="object-cover" />}
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-sm font-semibold text-brand-ink">{a.title}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{thaiDate(a.publishedAt)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/knowledge"
                  className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-800 hover:underline"
                >
                  ดูบทความทั้งหมด <ChevronRight size={15} aria-hidden="true" />
                </Link>
              </section>
            )}
            <section className="mt-6 rounded-xl2 bg-brand-gradient-soft p-5 lg:mt-0">
              <p className="font-bold text-brand-ink">ยังไม่แน่ใจว่าเหมาะกับคุณไหม?</p>
              <p className="mt-1 text-sm text-slate-600">ถามน้อง Smoothie ช่วยเลือกผลิตภัณฑ์ให้ตรงกับปัญหาของคุณ</p>
              <Link
                href="/advisor"
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-1000"
              >
                <MessageCircle size={16} aria-hidden="true" /> ปรึกษาน้อง Smoothie
              </Link>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
