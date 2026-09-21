// Phase 1 of brand/SEO-opportunity monitoring (see
// social-listening-seo-opportunity-plan.md): only the two sources buildable
// without a paid social-listening tool — our own product reviews, and
// Google Trends. Both write into the same `brand_signals` table so later
// phases (sentiment rollups, SEO opportunity scoring) can read one place
// regardless of where a signal came from.
import googleTrends from "google-trends-api";
import { supabaseRest } from "@/lib/supabase-server";
import { categories, concerns } from "@/data/categories";
import { articles } from "@/data/articles";

export type BrandSignalSource = "own_reviews" | "gsc" | "google_trends" | "social_listening_tool";
export type BrandSignalType = "review" | "mention" | "search_query" | "trend_point";
export type Sentiment = "positive" | "negative" | "neutral";

export type BrandSignalInput = {
  source: BrandSignalSource;
  signal_type: BrandSignalType;
  sentiment?: Sentiment;
  keyword?: string;
  content?: string;
  volume?: number;
  occurred_at?: string;
  raw?: unknown;
  /** Natural key within `source` — see the table's unique(source, dedupe_key). */
  dedupe_key: string;
};

/** Upserts by (source, dedupe_key) — safe to call the same sync job on a
 *  schedule without piling up duplicate rows for the same review/trend point. */
export async function recordSignals(signals: BrandSignalInput[]): Promise<void> {
  if (signals.length === 0) return;
  await supabaseRest("brand_signals?on_conflict=source,dedupe_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(signals),
  });
}

// ---------------------------------------------------------------------
// Own reviews

type ReviewRow = {
  id: string;
  product_slug: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
};

function sentimentFromRating(rating: number): Sentiment {
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

/** Only approved reviews — a pending one hasn't been checked for spam/abuse
 *  yet, and syncing it would let an unmoderated review shape an analysis
 *  before a person ever looked at it. */
export async function syncOwnReviews(): Promise<{ synced: number }> {
  const reviews = await supabaseRest<ReviewRow[]>(
    "product_reviews?status=eq.approved&select=id,product_slug,rating,title,body,created_at&order=created_at.desc&limit=500"
  );
  const signals: BrandSignalInput[] = reviews.map((r) => ({
    source: "own_reviews",
    signal_type: "review",
    sentiment: sentimentFromRating(r.rating),
    keyword: r.product_slug,
    content: [r.title, r.body].filter(Boolean).join(" — ") || undefined,
    volume: r.rating,
    occurred_at: r.created_at,
    raw: r,
    dedupe_key: r.id,
  }));
  await recordSignals(signals);
  return { synced: signals.length };
}

// ---------------------------------------------------------------------
// Google Trends
//
// Unofficial API (no official Google Trends API exists) — this library
// talks to the same endpoints the trends.google.com website itself uses to
// render its charts, the same approach every public Trends tool relies on.
// It can break if Google changes those endpoints; syncGoogleTrends()
// surfaces that as a normal thrown error rather than silently returning
// nothing, so a failure is visible in the sync result instead of just an
// empty table.

/** One entry per keyword worth watching, tagged with the page it represents
 *  — a brand name has no page of its own (`pageType: "brand"`), everything
 *  else maps to a real, crawlable page on the site so a later "which page
 *  should we improve" report has something to point at. */
export type TrendTarget = { keyword: string; pageType: "brand" | "category" | "concern" | "article"; pageSlug: string | null };

/** Adjust the brand list here once there's an admin page for it — the
 *  category/concern/article lists need no such list: they're derived from
 *  the site's own content, so a new blog post or category is picked up
 *  automatically the next time this runs, never hand-maintained twice. */
const BRAND_KEYWORDS = ["Smooth E", "Dentiste", "Smoothlife"];

export function getTrendTargets(): TrendTarget[] {
  return [
    ...BRAND_KEYWORDS.map((keyword): TrendTarget => ({ keyword, pageType: "brand", pageSlug: null })),
    ...categories.map((c): TrendTarget => ({ keyword: c.nameTh, pageType: "category", pageSlug: c.slug })),
    ...concerns.map((c): TrendTarget => ({ keyword: c.nameTh, pageType: "concern", pageSlug: c.slug })),
    ...articles.map((a): TrendTarget => ({ keyword: a.title, pageType: "article", pageSlug: a.slug })),
  ];
}

type TrendsTimelinePoint = { time: string; value: number[] };

// Google Trends throttles a burst of requests from one IP — the ~20-30
// targets here (brands + categories + concerns + articles) are comfortably
// under what it tolerates, but a small gap between requests is what every
// public Trends tool does to stay that way as the site's content grows.
const REQUEST_GAP_MS = 300;
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Measured against the live endpoint: asking for the same keyword twice in a
// row, the first call timed out and the second returned 31 points. This is an
// endpoint Google publishes for its own charts and does not promise to anyone
// else, so an occasional dropped connection is the normal weather rather than
// a fault to report. Without a retry a run loses a scattered third of its
// keywords, and a trend line with holes in it is worse than none.
const ATTEMPTS = 3;

async function interestOverTime(keyword: string): Promise<TrendsTimelinePoint[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const raw = await googleTrends.interestOverTime({ keyword, geo: "TH", hl: "th" });
      // The library's own README shows this as a raw JSON string; parse
      // defensively in case a future version returns the object directly.
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return parsed?.default?.timelineData ?? [];
    } catch (err) {
      lastError = err;
      if (attempt < ATTEMPTS) await sleep(attempt * 1000);
    }
  }
  throw lastError;
}

export async function syncGoogleTrends(targets: TrendTarget[] = getTrendTargets()): Promise<{ synced: number; failed: string[] }> {
  let total = 0;
  const failed: string[] = [];

  for (const target of targets) {
    try {
      // One request per keyword rather than a comparison request — comparing
      // multiple terms in one call rescales every value relative to the
      // largest of the group, which would make a small term look
      // artificially smaller than it really is. A separate 0-100 scale per
      // keyword is what's comparable over time for that keyword, which is
      // what a trend actually needs to mean.
      const points = await interestOverTime(target.keyword);

      const signals: BrandSignalInput[] = points.map((p) => {
        const occurredAt = new Date(Number(p.time) * 1000).toISOString();
        return {
          source: "google_trends",
          signal_type: "trend_point",
          keyword: target.keyword,
          volume: p.value?.[0] ?? 0,
          occurred_at: occurredAt,
          raw: { ...p, pageType: target.pageType, pageSlug: target.pageSlug },
          // One point per keyword per day — matches Trends' own daily
          // resolution for a lookback window this short.
          dedupe_key: `${target.keyword}:${occurredAt.slice(0, 10)}`,
        };
      });
      await recordSignals(signals);
      total += signals.length;
    } catch (err) {
      // One bad keyword (or a transient throttle) must not lose every other
      // target's data for this run — recorded and surfaced in the result
      // instead of thrown, so a partial sync is still visible as partial.
      console.error(`[brand-signals] google trends failed for "${target.keyword}"`, err);
      failed.push(target.keyword);
    }
    await sleep(REQUEST_GAP_MS);
  }
  return { synced: total, failed };
}
