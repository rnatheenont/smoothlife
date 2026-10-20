import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { aiEngineOf, AI_ENGINES } from "@/lib/ai-referrers";

// Whether opening /faq to search is working, in the two numbers that can be
// measured from here.
//
// Who read it: crawler hits on the pages we opened, counted by the proxy
// (bot_hits_daily). This is the early signal — Googlebot coming back means
// the page is in the crawl, OAI-SearchBot arriving means ChatGPT fetched an
// answer to quote — and it moves weeks before anything shows up in Search
// Console.
//
// Who arrived: visits whose first touch was an AI answer, broken down by
// which assistant sent them. Read from the attribution already stored on
// every checkout, so there is nothing new to capture — see ai-referrers.ts
// for why the engine is derived at read time rather than stored.
//
// Covered by the /api/admin/seo rule (seo.manage) in admin-route-permissions.
export const dynamic = "force-dynamic";

const DAYS = 30;

type BotRow = { day: string; bot: string; path: string; hits: number };
type AttrRow = { attr_channel: string | null; attr_utm_source: string | null; attr_referrer_host: string | null };

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value))
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  if (!supabaseConfigured())
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const sinceDay = new Date(Date.now() - DAYS * 86400_000).toISOString().slice(0, 10);
  const sinceTs = new Date(Date.now() - DAYS * 86400_000).toISOString();

  const [bots, orders] = await Promise.all([
    supabaseRest<BotRow[]>(
      `bot_hits_daily?day=gte.${sinceDay}&select=day,bot,path,hits&order=day.desc&limit=5000`,
    ).catch((): BotRow[] => []),
    supabaseRest<AttrRow[]>(
      `payment_transactions?created_at=gte.${encodeURIComponent(sinceTs)}` +
        `&select=attr_channel,attr_utm_source,attr_referrer_host&limit=5000`,
    ).catch((): AttrRow[] => []),
  ]);

  // Per crawler: how many hits, how many distinct pages, and when it last
  // came. "Last seen" is the one that answers the question people actually
  // ask — has it been back since we opened the FAQ.
  const perBot = new Map<string, { hits: number; paths: Set<string>; lastSeen: string }>();
  for (const row of bots) {
    const entry = perBot.get(row.bot) ?? { hits: 0, paths: new Set<string>(), lastSeen: row.day };
    entry.hits += row.hits;
    entry.paths.add(row.path);
    if (row.day > entry.lastSeen) entry.lastSeen = row.day;
    perBot.set(row.bot, entry);
  }

  const perPath = new Map<string, number>();
  for (const row of bots) perPath.set(row.path, (perPath.get(row.path) ?? 0) + row.hits);

  // Orders whose first touch was an AI answer. Counted per engine, and the
  // total of every order in the window alongside it — a count with nothing
  // to compare it against is not a measurement.
  const perEngine = new Map<string, number>();
  for (const row of orders) {
    const engine = aiEngineOf(row.attr_utm_source, row.attr_referrer_host);
    if (engine) perEngine.set(engine, (perEngine.get(engine) ?? 0) + 1);
  }

  return NextResponse.json({
    ok: true,
    days: DAYS,
    bots: [...perBot.entries()]
      .map(([bot, e]) => ({ bot, hits: e.hits, pages: e.paths.size, lastSeen: e.lastSeen }))
      .sort((a, b) => b.hits - a.hits),
    pages: [...perPath.entries()]
      .map(([path, hits]) => ({ path, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 15),
    ai: {
      orders: orders.length,
      fromAi: [...perEngine.values()].reduce((a, b) => a + b, 0),
      engines: AI_ENGINES.map((e) => ({ engine: e, orders: perEngine.get(e) ?? 0 })).filter(
        (e) => e.orders > 0,
      ),
    },
  });
}
