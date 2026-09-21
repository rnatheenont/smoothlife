import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { getTrendTargets, type TrendTarget } from "@/lib/brand-signals";

// "Which keyword should we work on next" — scored from the data this shop
// actually has, and explicit about the data it does not.
//
// What is measured: Google Trends interest for the phrase, and how often the
// shop's own visitors typed it into the site search (brand_signals and
// search_queries respectively).
//
// What is NOT measured, and is therefore never invented here:
//   - where the site ranks today. Search Console is not connected, so
//     our_current_rank stays null rather than being guessed.
//   - who else ranks for the phrase. No SERP data, so competition is a rule
//     of thumb about the *shape* of the keyword, labelled as such on screen:
//     a brand name is winnable by the brand's own site, a generic category
//     word is where the marketplaces live. That reasoning comes from
//     seo-strategy-plan.md §3 and is a starting point to be corrected once
//     real ranking data exists, not a finding.
//
// The honest way to read the percentage: "how much of a case is there for
// spending an afternoon on this page", not "how likely we are to rank".

export type OpportunityRow = {
  keyword: string;
  page_type: string | null;
  page_slug: string | null;
  search_volume_estimate: number | null;
  site_searches: number;
  site_searches_without_results: number;
  our_current_rank: number | null;
  competition_level: "low" | "medium" | "high";
  opportunity_percent: number;
  recommended_action: string;
  factors: Record<string, unknown>;
  computed_at: string;
};

/** A brand's own site should win its own name; a one-word category term is
 *  what Shopee ranks for. Everything in between is a judgement call, so it
 *  gets the middle band rather than a false precision. */
function competitionFor(target: TrendTarget): "low" | "medium" | "high" {
  if (target.pageType === "brand") return "low";
  if (target.pageType === "article") return "medium";
  // A short generic phrase is the marketplace's home ground; a longer,
  // more specific one is not worth their while to target.
  const words = target.keyword.trim().split(/\s+/).length;
  if (target.keyword.length <= 12 && words <= 2) return "high";
  return "medium";
}

const COMPETITION_WEIGHT = { low: 1, medium: 0.6, high: 0.25 } as const;

type TrendAverage = { keyword: string; avg_volume: number; points: number };
type SiteSearch = { normalized: string; searches: number; zero_result_searches: number };

function actionFor(row: {
  demand: number;
  siteSearches: number;
  zeroResults: number;
  hasPage: boolean;
  competition: "low" | "medium" | "high";
}): string {
  if (row.zeroResults > 0) {
    return "คนค้นคำนี้ในเว็บแล้วไม่เจอสินค้า — เช็กว่าของขาด หรือชื่อสินค้าไม่ตรงกับคำที่คนเรียก";
  }
  if (!row.hasPage) return "ยังไม่มีหน้าสำหรับคำนี้ — พิจารณาเขียนบทความหรือทำหน้ารวมสินค้า";
  if (row.competition === "high") {
    return "คำกว้างที่ marketplace ครองอยู่ — ใช้เป็นคำรอง อย่าทุ่มกับคำนี้คำเดียว";
  }
  if (row.demand >= 40) return "ความต้องการสูงและแข่งไหว — ตั้งค่า SEO ของหน้านี้ก่อนเพื่อนในหน้า /admin/seo";
  return "ความต้องการยังน้อย — ทำได้แต่ไม่เร่ง";
}

/**
 * Recomputes every keyword's score from the signals already collected.
 * Returns what it wrote so a caller can show it without re-reading.
 */
export async function computeOpportunities(days = 90): Promise<OpportunityRow[]> {
  const targets = getTrendTargets();

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const trendRows = await supabaseRest<{ keyword: string; volume: number }[]>(
    `brand_signals?source=eq.google_trends&occurred_at=gt.${pgValue(since)}&select=keyword,volume&limit=10000`
  ).catch((): { keyword: string; volume: number }[] => []);

  const byKeyword = new Map<string, TrendAverage>();
  for (const row of trendRows) {
    const entry = byKeyword.get(row.keyword) ?? { keyword: row.keyword, avg_volume: 0, points: 0 };
    entry.avg_volume = (entry.avg_volume * entry.points + Number(row.volume ?? 0)) / (entry.points + 1);
    entry.points += 1;
    byKeyword.set(row.keyword, entry);
  }

  const siteSearches = await supabaseRest<SiteSearch[]>("rpc/search_query_stats", {
    method: "POST",
    body: JSON.stringify({ p_days: days, p_limit: 500 }),
  }).catch((): SiteSearch[] => []);
  const searchesByTerm = new Map(siteSearches.map((s) => [s.normalized, s]));

  // The strongest site-search terms are worth scoring even when they match no
  // page we track: a word people type and do not find is the clearest gap
  // this shop can see.
  const extraFromSearch: TrendTarget[] = siteSearches
    .filter((s) => !targets.some((t) => t.keyword.toLowerCase() === s.normalized))
    .slice(0, 50)
    .map((s) => ({ keyword: s.normalized, pageType: "article", pageSlug: null }));

  const rows: OpportunityRow[] = [...targets, ...extraFromSearch].map((target) => {
    const trend = byKeyword.get(target.keyword);
    const search = searchesByTerm.get(target.keyword.toLowerCase());
    const competition = competitionFor(target);

    // Trends is 0-100 already. Site searches are counted, so they are folded
    // in on a scale where a handful of real shoppers is worth noticing
    // without swamping a nationally-searched term.
    const trendDemand = trend ? trend.avg_volume : 0;
    const searchDemand = Math.min(40, (search?.searches ?? 0) * 4);
    const demand = Math.max(trendDemand, searchDemand);

    const hasPage = Boolean(target.pageSlug);
    // Nothing to lose: a phrase with demand and no page of ours is the
    // clearest kind of opportunity there is.
    const noPageBonus = hasPage ? 1 : 1.25;

    const percent = Math.round(Math.min(100, demand * COMPETITION_WEIGHT[competition] * noPageBonus));

    return {
      keyword: target.keyword,
      page_type: target.pageType,
      page_slug: target.pageSlug,
      search_volume_estimate: trend ? Math.round(trend.avg_volume * 10) / 10 : null,
      site_searches: search?.searches ?? 0,
      site_searches_without_results: search?.zero_result_searches ?? 0,
      our_current_rank: null,
      competition_level: competition,
      opportunity_percent: percent,
      recommended_action: actionFor({
        demand,
        siteSearches: search?.searches ?? 0,
        zeroResults: search?.zero_result_searches ?? 0,
        hasPage,
        competition,
      }),
      factors: {
        trend_points: trend?.points ?? 0,
        trend_average: trend ? Math.round(trend.avg_volume * 10) / 10 : null,
        site_searches: search?.searches ?? 0,
        competition_weight: COMPETITION_WEIGHT[competition],
        no_page_bonus: noPageBonus,
        note:
          "competition_level เป็นการประเมินจากรูปแบบของคำ ไม่ใช่การวัดหน้าผลค้นหาจริง — ต้องต่อ Search Console ก่อนถึงจะรู้อันดับจริง",
      },
      computed_at: new Date().toISOString(),
    };
  });

  if (rows.length > 0) {
    await supabaseRest("seo_opportunity_scores?on_conflict=keyword", {
      method: "POST",
      returning: false,
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    });
  }
  return rows.sort((a, b) => b.opportunity_percent - a.opportunity_percent);
}
