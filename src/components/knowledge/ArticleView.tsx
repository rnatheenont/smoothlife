import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, Clock, MessageCircle } from "lucide-react";
import type { Article } from "@/data/types";
import { articleJsonLd, breadcrumbJsonLd, jsonLdScript } from "@/lib/json-ld";
import { storeArticleHref, thaiDate, type StoreArticle } from "@/lib/storefront-articles";

// One article page, whole.
//
// It lives here rather than inside the route because two things draw it now:
// the route, while wave 3 is off, and the article template's own section. A
// page that exists twice is a page that drifts, so there is one copy and both
// callers hand it the same data.
//
// Phone: one column — back link, title, meta, cover, body, then other posts.
// Desktop (lg): the reading column stays ~720px wide for comfortable line
// length, and the space beside it holds a sticky rail with other posts and
// the advisor, so the page uses the width without stretching the text.
//
// The rail is `lg:sticky` and a sticky element can only travel inside its own
// parent, which is why the whole page is one block and not a header, a body
// and a rail as three sections — see the same note on /shop's category row.

/** The words in the rail, which are the only editable thing on this page. */
export type ArticleRail = {
  othersHeading: string;
  othersCtaLabel: string;
  othersCtaHref: string;
  advisorTitle: string;
  advisorBody: string;
  advisorCtaLabel: string;
  advisorCtaHref: string;
};

export const ARTICLE_RAIL_DEFAULT: ArticleRail = {
  othersHeading: "บทความอื่น",
  othersCtaLabel: "ดูบทความทั้งหมด",
  othersCtaHref: "/knowledge",
  advisorTitle: "ยังไม่แน่ใจว่าเหมาะกับคุณไหม?",
  advisorBody: "ถามน้อง Smoothie ช่วยเลือกผลิตภัณฑ์ให้ตรงกับปัญหาของคุณ",
  advisorCtaLabel: "ปรึกษาน้อง Smoothie",
  advisorCtaHref: "/advisor",
};

export default function ArticleView({
  guide,
  post,
  others,
  rail,
}: {
  guide?: Article | null;
  post?: StoreArticle | null;
  others: StoreArticle[];
  rail: ArticleRail;
}) {
  if (!guide && !post) return null;

  const title = guide ? guide.title : post!.title;
  const excerpt = guide ? undefined : post!.excerpt;
  const image = guide ? guide.image : post!.image;

  const meta = guide ? (
    <>
      <span>{guide.readMins} นาทีในการอ่าน</span>
      {/* Only rendered once a real date exists — see Article.publishedAt
          in data/types.ts for why this stays hidden rather than
          showing a made-up one. */}
      {guide.updatedAt && (
        <span>
          อัปเดตล่าสุด <time dateTime={guide.updatedAt}>{thaiDate(guide.updatedAt)}</time>
        </span>
      )}
    </>
  ) : (
    <>
      <time dateTime={post!.publishedAt}>{thaiDate(post!.publishedAt)}</time>
      <span className="flex items-center gap-1">
        <Clock size={14} aria-hidden="true" /> อ่าน {post!.readMins} นาที
      </span>
    </>
  );

  const body = guide ? (
    <>
      {(guide.publishedAt || guide.updatedAt) && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd(guide)) }} />
      )}
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
    </>
  ) : (
    <div className="article-body" dangerouslySetInnerHTML={{ __html: post!.html }} />
  );

  // Mirrors the visible trail below — Google wants the markup to describe
  // what the reader can actually see.
  const breadcrumbItems = [
    { label: "หน้าแรก", href: "/" },
    { label: "ความรู้เรื่องผิวและสุขภาพ", href: "/knowledge" },
    { label: title },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(breadcrumbItems)) }} />
      {/* The page is as wide as what is on it, centred, rather than as wide
          as the container.

          The reading column is capped at 720px for line length and the rail
          is 320px, so on a 1512 container the first grid track came out
          1080px holding 720px of text: 424px of measured nothing between the
          article and the rail, with the breadcrumb stretching past both. The
          cap belongs to the whole block rather than to the text inside one
          track — 720 + the gap + 320, which is 1088 at lg and 1104 once the
          gap widens at xl. Narrower than that the track is still fluid and
          shrinks the way it always did. */}
      <div className="mx-auto w-full lg:max-w-[1088px] xl:max-w-[1104px]">
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
{/* No cap of its own any more: the track it sits in is what the
              720px is made of now. Two places holding the same measure is
              how the hole got in. */}
          <article className="min-w-0">
            <h1 className="mt-3 text-2xl font-extrabold leading-snug text-brand-ink md:text-4xl md:leading-tight lg:mt-0 lg:text-[2.5rem]">
              {title}
            </h1>
            {excerpt && <p className="mt-3 hidden text-lg leading-relaxed text-slate-600 lg:block">{excerpt}</p>}
            <p className="mt-3 flex items-center gap-3 text-sm text-slate-500 lg:mt-4">{meta}</p>
            {image && (
              <div className="relative mt-5 aspect-video overflow-hidden rounded-xl2 bg-surface-mist md:mt-7">
                <Image src={image} alt="" fill priority sizes="(max-width: 1024px) 100vw, 720px" className="object-cover" />
              </div>
            )}
            <div className="mt-6 md:mt-8">{body}</div>
          </article>

          <aside className="mt-12 border-t border-surface-line pt-8 lg:mt-0 lg:border-0 lg:pt-0">
            <div className="lg:sticky lg:top-40 lg:flex lg:flex-col lg:gap-6">
              {others.length > 0 && (
                <section className="lg:rounded-xl2 lg:border lg:border-surface-line lg:p-5">
                  <h2 className="text-lg font-bold text-brand-ink lg:text-base">{rail.othersHeading}</h2>
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
                    href={rail.othersCtaHref}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-800 hover:underline"
                  >
                    {rail.othersCtaLabel} <ChevronRight size={15} aria-hidden="true" />
                  </Link>
                </section>
              )}
              <section className="mt-6 rounded-xl2 bg-brand-gradient-soft p-5 lg:mt-0">
                <p className="font-bold text-brand-ink">{rail.advisorTitle}</p>
                <p className="mt-1 text-sm text-slate-600">{rail.advisorBody}</p>
                <Link
                  href={rail.advisorCtaHref}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-1000"
                >
                  <MessageCircle size={16} aria-hidden="true" /> {rail.advisorCtaLabel}
                </Link>
              </section>
            </div>
  </aside>
        </div>
      </div>
    </>
  );
}
