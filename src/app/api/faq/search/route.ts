import { NextRequest, NextResponse } from "next/server";
import { searchKb } from "@/lib/kb";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { getFaqArticles } from "@/lib/faq-public";
import { normalize } from "@/lib/faq-score";

// Layer two of the FAQ search: meaning, for the questions substring matching
// cannot reach.
//
// The browser does the first pass with no request at all. This runs only when
// that came back thin or the customer wrote a whole sentence, which is the
// case worth paying an embedding for — "กว่าจะหลับใช้เวลาเป็นชั่วโมง" shares
// no literal string with "มีอาหารเสริมสำหรับการพักผ่อนก่อนนอนหรือไม่?" and
// layer one will never find it.
//
// Returns slugs, not answers. The answers are already in the page the caller
// is looking at; sending them again would double the payload to reorder a
// list the browser already has.
export const dynamic = "force-dynamic";

const LIMIT = 6;
const MAX_QUERY = 120;
/** Per IP. Generous: the browser debounces, and a real person typing and
 *  rephrasing will legitimately hit this a dozen times in a minute. */
const RATE = { attempts: 30, windowMs: 60_000 };
const CACHE_SECONDS = 86_400;

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") ?? "").slice(0, MAX_QUERY).trim();
  if (!raw) return NextResponse.json({ slugs: [] });

  if (isRateLimited(`faq-search:${clientIp(req)}`, RATE.attempts, RATE.windowMs)) {
    // 429 and an empty list: layer one's answer is still on screen, so the
    // page degrades to "the fast search only" rather than to an error.
    return NextResponse.json({ slugs: [] }, { status: 429 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ slugs: [] });

  try {
    const [matches, articles] = await Promise.all([searchKb(raw, LIMIT), getFaqArticles()]);

    // Only questions that have a public page. kb_search also returns the
    // `ai_only` articles, which exist for the assistant to quote and are
    // written about customers rather than to them.
    const slugById = new Map(articles.map((a) => [a.id, a.public_slug]));
    const seen = new Set<string>();
    const slugs: string[] = [];
    for (const m of matches) {
      const slug = slugById.get(m.article_id);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      slugs.push(slug);
    }

    void logSearch(raw, slugs.length);

    return NextResponse.json(
      { slugs },
      {
        headers: {
          // Cached at the edge by URL, so the same question asked by the next
          // visitor costs nothing. A day, because the answer set only changes
          // when somebody publishes.
          "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
        },
      }
    );
  } catch (err) {
    console.error("[faq] search failed", err);
    return NextResponse.json({ slugs: [] }, { status: 200 });
  }
}

/**
 * What people searched for, and the ones that found nothing.
 *
 * Only the searches that reach this route are recorded, which is a narrower
 * set than every keystroke on the page — layer one answers most of them in
 * the browser and never asks the server. That is the deliberate trade: the
 * alternative is a beacon on every search, and the searches this route sees
 * are already the interesting ones, the questions the written FAQ did not
 * obviously answer.
 *
 * Never allowed to fail the request. A customer's search result does not
 * depend on our bookkeeping.
 */
async function logSearch(query: string, results: number) {
  const normalized = normalize(query);
  try {
    await supabaseRest("search_queries", {
      method: "POST",
      returning: false,
      body: JSON.stringify({ query: query.slice(0, 200), normalized: normalized.slice(0, 200), results, scope: "faq" }),
    });

    if (results > 0) return;

    // A question with no answer is the one thing on this page worth acting
    // on. Counted rather than appended, so "ส่งกี่วัน" asked two hundred
    // times is one row with hits=200 and not two hundred rows.
    const existing = await supabaseRest<{ id: string; hits: number; examples: string[] | null }[]>(
      `kb_gaps?question=eq.${pgValue(normalized)}&select=id,hits,examples&limit=1`
    );
    const hit = existing?.[0];
    if (hit) {
      const examples = [...new Set([...(hit.examples ?? []), query])].slice(-10);
      await supabaseRest(`kb_gaps?id=eq.${hit.id}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ hits: (hit.hits ?? 0) + 1, examples, last_seen: new Date().toISOString() }),
      });
    } else {
      await supabaseRest("kb_gaps", {
        method: "POST",
        returning: false,
        body: JSON.stringify({ question: normalized.slice(0, 300), examples: [query], hits: 1, sources: ["faq"], status: "open" }),
      });
    }
  } catch {
    // Silent on purpose — see above.
  }
}
