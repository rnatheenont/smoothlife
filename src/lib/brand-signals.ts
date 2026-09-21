// Phase 1 of brand/SEO-opportunity monitoring (see
// social-listening-seo-opportunity-plan.md): only the two sources buildable
// without a paid social-listening tool — our own product reviews, and
// Google Trends. Both write into the same `brand_signals` table so later
// phases (sentiment rollups, SEO opportunity scoring) can read one place
// regardless of where a signal came from.
import googleTrends from "google-trends-api";
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { categories, concerns } from "@/data/categories";
import { articles } from "@/data/articles";

export type BrandSignalSource = "own_reviews" | "own_chat" | "gsc" | "google_trends" | "social_listening_tool";
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
  // Every row is spelled out with the same keys, nulls included. PostgREST
  // refuses a batch whose objects differ in shape ("All object keys must
  // match"), and JSON.stringify drops an undefined field entirely — so one
  // chat message that happened to be sent from a product page and one that
  // was not made two different shapes, and the whole batch was rejected.
  const rows = signals.map((s) => ({
    source: s.source,
    signal_type: s.signal_type,
    sentiment: s.sentiment ?? null,
    keyword: s.keyword ?? null,
    content: s.content ?? null,
    volume: s.volume ?? null,
    occurred_at: s.occurred_at ?? null,
    raw: s.raw ?? null,
    dedupe_key: s.dedupe_key,
  }));
  await supabaseRest("brand_signals?on_conflict=source,dedupe_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
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
// What customers actually said
//
// The question this system exists to answer is "what does the market say
// about us", and Trends cannot answer it: it counts how many people looked,
// never what they said. The words themselves are not on Facebook or TikTok
// as far as this code can reach — those platforms closed keyword search to
// everyone but their paid partners — but there is a corpus nobody has read:
// the messages customers typed into this shop's own chat, and the moments the
// assistant had to hand one to a person.
//
// It is the smallest honest version of social listening: fewer people than a
// listening tool sees, but every one of them was talking to this brand, in
// their own words, unprompted.

type ChatRow = { id: string; content: string; viewing_product_slug: string | null; created_at: string };
type EscalationRow = {
  id: string;
  transcript: string | null;
  status: string | null;
  product_slug: string | null;
  created_at: string;
};

/** Customer-authored chat only. The assistant's own replies are this shop
 *  talking to itself, and counting them as voice of the customer would let
 *  the brand's own words become evidence about the brand. */
export async function syncCustomerVoice(): Promise<{ messages: number; escalations: number }> {
  const messages = await supabaseRest<ChatRow[]>(
    "chat_messages?role=eq.user&from_staff=is.false&select=id,content,viewing_product_slug,created_at" +
      "&order=created_at.desc&limit=1000"
  ).catch((): ChatRow[] => []);

  const messageSignals: BrandSignalInput[] = messages
    .filter((m) => (m.content ?? "").trim().length > 1)
    .map((m) => ({
      source: "own_chat",
      signal_type: "mention",
      keyword: m.viewing_product_slug ?? undefined,
      content: m.content.slice(0, 2000),
      occurred_at: m.created_at,
      dedupe_key: m.id,
    }));
  await recordSignals(messageSignals);

  // A handover is the clearest negative signal this shop collects: the
  // moment its own assistant could not answer someone.
  // Selected by name, not with *: the row also holds the phone number or
  // email the customer left to be contacted on, and that has no business
  // being copied into an analysis table.
  const escalations = await supabaseRest<EscalationRow[]>(
    "chat_escalations?select=id,transcript,status,product_slug,created_at&order=created_at.desc&limit=500"
  ).catch((): EscalationRow[] => []);

  const escalationSignals: BrandSignalInput[] = escalations.map((e) => ({
    source: "own_chat",
    signal_type: "mention",
    sentiment: "negative",
    // Which product this handover was about, when the customer had one open
    // — without it, the strongest negative signal this shop collects was
    // invisible to any per-product breakdown, only readable one transcript
    // at a time.
    keyword: e.product_slug ?? undefined,
    // The tail of the transcript is the part that failed — the earlier turns
    // are usually the assistant answering fine.
    content: (e.transcript ?? "").slice(-1500) || "(ส่งต่อให้ทีมงานโดยไม่มีบทสนทนา)",
    occurred_at: e.created_at,
    dedupe_key: `escalation:${e.id}`,
  }));
  await recordSignals(escalationSignals);

  return { messages: messageSignals.length, escalations: escalationSignals.length };
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

// ---------------------------------------------------------------------
// Which product this is actually about
//
// The AI summary above reads every signal as prose and only names a product
// if it happens to notice one repeated — real, but not something a person
// can rely on to catch every case. This counts instead: a plain group-by on
// the one structured field every review and tagged mention already carries,
// so "which product has a problem" is a number to scan, not a hope that the
// model mentioned it.

export type ProductSignalBreakdown = {
  keyword: string;
  negative: number;
  positive: number;
  neutral: number;
  /** Tagged to a product, but the source (a plain chat message) carries no
   *  sentiment of its own — counted as attention, not read as a complaint. */
  unclassified: number;
  total: number;
};

export async function getProductBreakdown(days = 30): Promise<ProductSignalBreakdown[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await supabaseRest<{ keyword: string | null; sentiment: string | null }[]>(
    `brand_signals?keyword=not.is.null&occurred_at=gt.${pgValue(since.toISOString())}` +
      "&select=keyword,sentiment&limit=5000"
  ).catch((): { keyword: string | null; sentiment: string | null }[] => []);

  const byKeyword = new Map<string, ProductSignalBreakdown>();
  for (const row of rows) {
    if (!row.keyword) continue;
    const entry = byKeyword.get(row.keyword) ?? {
      keyword: row.keyword,
      negative: 0,
      positive: 0,
      neutral: 0,
      unclassified: 0,
      total: 0,
    };
    entry.total += 1;
    if (row.sentiment === "negative") entry.negative += 1;
    else if (row.sentiment === "positive") entry.positive += 1;
    else if (row.sentiment === "neutral") entry.neutral += 1;
    else entry.unclassified += 1;
    byKeyword.set(row.keyword, entry);
  }

  // Worst first — the question this answers is "what do I fix next", not
  // "what gets talked about most".
  return [...byKeyword.values()].sort((a, b) => b.negative - a.negative || b.total - a.total);
}
