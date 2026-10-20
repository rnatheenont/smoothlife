import { getFaqArticles } from "@/lib/faq-public";
import { SITE_URL } from "@/lib/site-url";
import { indexablePath } from "@/lib/search-visibility";

/**
 * The sitemap we actually submit.
 *
 * /sitemap.xml lists everything this app serves — around eleven hundred
 * URLs, and all but these carry noindex. Handing that to Search Console
 * would be asking Google to spend its crawl of this site on pages we have
 * told it it may not keep, and submitted URLs that come back noindex are
 * reported as errors besides. So the submitted sitemap is its own file,
 * holding exactly the pages that are open: /faq and one page per published
 * answer.
 *
 * Every entry is checked against indexablePath before it goes out. The two
 * lists could drift apart — somebody opens a new section to search, or moves
 * the FAQ — and the failure would be silent in both directions: a sitemap
 * full of noindex URLs, or pages open to search that nothing points at.
 *
 * lastmod is the answer's real updated_at. A sitemap that claims every page
 * changed today teaches a crawler to stop believing the field, and the whole
 * reason to publish one for the FAQ is that edits should be picked up
 * quickly.
 *
 * Built from getFaqArticles — the same call /faq itself renders from, which
 * filters visibility as well as status. An approved-but-internal answer has
 * no public page, so listing it would be submitting a URL that 404s.
 */
export const revalidate = 900;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const articles = await getFaqArticles();

  const entries = [
    { path: "/faq", lastmod: articles[0]?.updated_at ?? new Date().toISOString() },
    ...articles.map((a) => ({
      path: `/faq/${encodeURIComponent(a.public_slug)}`,
      lastmod: a.updated_at,
    })),
  ].filter((e) => indexablePath(e.path.split("?")[0]));

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(
        (e) =>
          `  <url>\n    <loc>${xmlEscape(`${SITE_URL}${e.path}`)}</loc>\n` +
          `    <lastmod>${new Date(e.lastmod).toISOString()}</lastmod>\n  </url>\n`,
      )
      .join("") +
    `</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Long enough that a crawler re-fetching it costs nothing, short
      // enough that a newly published answer is listed the same day.
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
