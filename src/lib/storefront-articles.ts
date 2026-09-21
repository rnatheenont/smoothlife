// The articles the team publishes in Shopify (Content → Blog posts), read off
// the public www.smoothlife.com blog feed. The Storefront token lacks the
// unauthenticated_read_content scope, so the feed is the one source that needs
// no new permission — and, like the banners (storefront-banners.ts), it only
// ever GETs public URLs, so nothing on smoothlife.com is touched. Cached for
// 30 minutes: a post published, edited or hidden there shows up here within
// that window. A failed read returns null and callers keep the static list.

const STOREFRONT = "https://www.smoothlife.com";
const BLOG = "stories";
const REVALIDATE_SECONDS = 1800;
const FETCH_OPTS = {
  headers: { "User-Agent": "Mozilla/5.0 (compatible; SmoothlifeWeb/1.0)" },
  next: { revalidate: REVALIDATE_SECONDS, tags: ["store-articles"] },
};

export type StoreArticle = {
  handle: string;
  title: string;
  publishedAt: string;
  excerpt: string;
  /** Article body, with scripts, frames, inline handlers and styles removed. */
  html: string;
  image: string | null;
  readMins: number;
  /** The same article on www.smoothlife.com (used as the canonical URL). */
  sourceUrl: string;
  /** What Shopify's own SEO fields say for this post, when the team filled
   *  them in there. Read from the rendered page rather than the API: the
   *  Storefront token has no content scope, and the page head is what
   *  Shopify renders those fields into anyway. */
  seoTitle: string | null;
  seoDescription: string | null;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

function tag(entry: string, name: string): string {
  const m = entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : "";
}

// Feed fields are CDATA-wrapped HTML (taken as is) or entity-escaped text.
function fieldHtml(raw: string): string {
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return cdata ? cdata[1] : decodeEntities(raw);
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// Posts are written by staff in the Shopify editor, but they are still HTML
// from outside this codebase: keep the markup, drop anything that runs code or
// restyles the page.
function cleanBody(html: string): string {
  const safe = html
    .replace(/<(script|style|iframe|object|embed|form|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|iframe|object|embed|link|meta|base|input|button)[^>]*\/?>/gi, "")
    .replace(/\s(on\w+|style|class|id|width|height)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, "")
    .replace(/<a\s/gi, '<a rel="noopener noreferrer" target="_blank" ')
    .replace(/<img\s/gi, '<img loading="lazy" ')
    .replace(/(<p>\s*(&nbsp;|\s)*<\/p>)+/gi, "")
    // Some posts wrap the whole body in a quote block; keep only real quotes.
    .replace(/<(\/?)blockquote>/gi, "<$1div>");
  // Posts pasted from Word often set whole paragraphs as bold headings; a
  // "heading" longer than a line of text is body copy, so it reads as one.
  return safe.replace(/<(h[1-6])>([\s\S]*?)<\/\1>/gi, (whole, _h, inner: string) =>
    plainText(inner).length > 90 ? `<p>${inner.replace(/<\/?(b|strong)>/gi, "")}</p>` : whole
  );
}

// Thai has no spaces between words, so a word count means nothing; about 700
// characters a minute is a comfortable reading pace for Thai body text.
function readingMinutes(text: string): number {
  return Math.max(1, Math.round(text.length / 700));
}

function excerptOf(summary: string, body: string): string {
  const text = plainText(summary) || plainText(body);
  return text.length > 140 ? `${text.slice(0, 140).trimEnd()}…` : text;
}

// The post's featured image is only on its page (og:image), not in the feed.
/** One fetch of the article's own page, for everything only the rendered
 *  page knows: its social image, and the SEO title and description the team
 *  typed into Shopify. */
async function pageMeta(url: string): Promise<{ image: string | null; seoTitle: string | null; seoDescription: string | null }> {
  const empty = { image: null, seoTitle: null, seoDescription: null };
  try {
    const res = await fetch(url, FETCH_OPTS);
    if (!res.ok) return empty;
    const page = await res.text();

    let image: string | null = null;
    const m = page.match(/<meta property="og:image" content="([^"]+)"/);
    if (m) {
      const u = new URL(decodeEntities(m[1]).replace(/^\/\//, "https://"));
      u.searchParams.delete("crop");
      u.searchParams.delete("height");
      u.searchParams.set("width", "900");
      image = u.toString();
    }

    // Shopify appends " – <shop name>" to the page title; the SEO field the
    // team actually wrote is the part before it.
    const rawTitle = page.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const seoTitle = rawTitle ? decodeEntities(rawTitle).replace(/\s*[–|]\s*Smooth Life\s*$/, "").trim() || null : null;
    const rawDesc = page.match(/<meta name="description" content="([^"]*)"/)?.[1];
    const seoDescription = rawDesc ? decodeEntities(rawDesc).trim() || null : null;

    return { image, seoTitle, seoDescription };
  } catch {
    return empty;
  }
}

function firstBodyImage(html: string): string | null {
  const m = html.match(/<img[^>]*src="(https:\/\/(?:cdn\.shopify\.com|www\.smoothlife\.com)[^"]+)"/i);
  return m ? m[1] : null;
}

async function getStoreArticlesUnsafe(): Promise<StoreArticle[] | null> {
  const res = await fetch(`${STOREFRONT}/blogs/${BLOG}.atom`, FETCH_OPTS);
  if (!res.ok) return null;
  const feed = await res.text();
  const entries = feed.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

  const parsed = entries
    .map((entry) => {
      const link = entry.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "";
      const path = link.match(new RegExp(`/blogs/${BLOG}/([^/?#]+)`));
      if (!path) return null;
      const body = fieldHtml(tag(entry, "content"));
      return {
        handle: decodeURIComponent(path[1]),
        title: plainText(fieldHtml(tag(entry, "title"))),
        publishedAt: tag(entry, "published"),
        excerpt: excerptOf(fieldHtml(tag(entry, "summary")), body),
        html: cleanBody(body),
        readMins: readingMinutes(plainText(body)),
        sourceUrl: link,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null && a.title !== "");

  if (parsed.length === 0) return null;
  const meta = await Promise.all(parsed.map((a) => pageMeta(a.sourceUrl)));
  return parsed
    .map((a, i) => ({
      ...a,
      image: meta[i].image ?? firstBodyImage(a.html),
      seoTitle: meta[i].seoTitle,
      seoDescription: meta[i].seoDescription,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getStoreArticles(): Promise<StoreArticle[] | null> {
  try {
    return await getStoreArticlesUnsafe();
  } catch {
    return null;
  }
}

export async function getStoreArticle(handle: string): Promise<StoreArticle | null> {
  let wanted = handle;
  try {
    wanted = decodeURIComponent(handle);
  } catch {
    // already decoded
  }
  return (await getStoreArticles())?.find((a) => a.handle === wanted) ?? null;
}

export function storeArticleHref(a: Pick<StoreArticle, "handle">): string {
  return `/knowledge/article/${encodeURIComponent(a.handle)}`;
}

export function thaiDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
}
