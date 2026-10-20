import { canonicalHost, indexablePath } from "./search-visibility.ts";

/**
 * Telling Bing — and through it Copilot — the moment an answer changes.
 *
 * A sitemap is a standing invitation: a crawler comes back when it feels
 * like it, which for a subdomain with no history can be weeks. IndexNow is
 * the other direction — one HTTP call that says "this URL changed, come
 * and look" — and it is the difference between an answer published today
 * being quotable this week or next month. Bing, Yandex, Seznam and Naver
 * share one submission; Google does not take part, and the sitemap is what
 * serves it.
 *
 * Three rules hold here, all of them about not lying to a search engine:
 *
 * Only pages that are open to search are submitted. Everything else on this
 * app answers with noindex, and asking an engine to fetch a page we then
 * refuse it is how a site loses the benefit of the doubt on the pages it
 * does want.
 *
 * Nothing is submitted until NEXT_PUBLIC_SITE_URL names a real domain. The
 * submitted host must be the host that serves the key, and a preview
 * deployment is neither.
 *
 * And it never throws, and never blocks. The caller is an admin saving an
 * answer; whether Bing was told is not a reason for that save to fail or to
 * sit waiting. Call it through `after()`.
 */

const ENDPOINT = "https://api.indexnow.org/indexnow";

/** Where the key file is served. Not `<key>.txt` at the root: the spec
 *  allows naming the location explicitly, which keeps this one ordinary
 *  route instead of a catch-all at the top of the app. */
export const KEY_PATH = "/indexnow-key.txt";

export type IndexNowResult =
  | { ok: true; submitted: number; status: number }
  | { ok: false; reason: string };

/** The URLs to submit when these answers change: each one's own page, plus
 *  the index that lists them. A slug that is null — an answer with no public
 *  page — contributes nothing. */
export function faqUrlsFor(slugs: (string | null | undefined)[]): string[] {
  const paths = new Set<string>(["/faq"]);
  for (const slug of slugs) {
    if (slug) paths.add(`/faq/${encodeURIComponent(slug)}`);
  }
  return [...paths];
}

export async function pingIndexNow(paths: string[]): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return { ok: false, reason: "ยังไม่ได้ตั้ง INDEXNOW_KEY" };

  const host = canonicalHost();
  if (!host) return { ok: false, reason: "ยังไม่ได้ตั้ง NEXT_PUBLIC_SITE_URL เป็นโดเมนจริง" };

  const origin = `https://${host}`;
  const urlList = paths.filter((p) => indexablePath(p)).map((p) => `${origin}${p}`);
  if (urlList.length === 0) return { ok: false, reason: "ไม่มี URL ที่เปิดให้ค้นหาในรายการนี้" };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${origin}${KEY_PATH}`,
        urlList,
      }),
    });
    // 200 accepted, 202 accepted but the key is still being checked. Both
    // mean the submission landed; anything else is worth seeing in the log.
    if (!res.ok) {
      console.error("[indexnow]", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return { ok: false, reason: `IndexNow ตอบ ${res.status}` };
    }
    return { ok: true, submitted: urlList.length, status: res.status };
  } catch (err) {
    console.error("[indexnow]", err);
    return { ok: false, reason: "เรียก IndexNow ไม่สำเร็จ" };
  }
}

/** The common case: some answers changed, tell Bing about them. */
export async function pingFaqChanged(slugs: (string | null | undefined)[]): Promise<IndexNowResult> {
  return pingIndexNow(faqUrlsFor(slugs));
}
