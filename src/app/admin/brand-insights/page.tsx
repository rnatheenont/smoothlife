"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Sparkles, ArrowUpRight, AlertTriangle, MessageSquare, Target, ThumbsUp, Search } from "lucide-react";
import { Button } from "@/components/ui";
import { useAdminAction } from "@/components/admin/header-action";

// What the brand's own signals say, and which keyword is worth the next
// afternoon.
//
// The page answers three questions and is laid out in the order they get
// asked: how do people feel, what do they keep saying, and what should we do
// about it. The four figures at the top are the short answer — the panels
// below are where you go when one of them looks wrong.
//
// Full width on purpose (see FULL_WIDTH in the admin layout): the opportunity
// table has six columns, one of them a sentence, and reading it in a 1,100px
// column meant a horizontal scrollbar on every screen.

type Insight = {
  id: string;
  period_start: string;
  period_end: string;
  summary: string | null;
  positive_themes: string[] | null;
  negative_themes: string[] | null;
  recommendations: string[] | null;
  signals_considered: number;
  created_at: string;
};

type ProductBreakdown = {
  keyword: string;
  negative: number;
  positive: number;
  neutral: number;
  unclassified: number;
  total: number;
};

type Opportunity = {
  keyword: string;
  page_type: string | null;
  page_slug: string | null;
  search_volume_estimate: number | null;
  site_searches: number;
  site_searches_without_results: number;
  competition_level: "low" | "medium" | "high";
  opportunity_percent: number;
  recommended_action: string;
};

const COMPETITION_TH = { low: "แข่งไม่ยาก", medium: "ปานกลาง", high: "แข่งยาก" };

export default function BrandInsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [breakdown, setBreakdown] = useState<ProductBreakdown[]>([]);
  const [sentiment, setSentiment] = useState({ positive: 0, neutral: 0, negative: 0 });
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/brand-insights");
    const data = await res.json().catch(() => null);
    setInsights(data?.insights ?? []);
    setOpportunities(data?.opportunities ?? []);
    setBreakdown(data?.breakdown ?? []);
    setSentiment(data?.sentiment ?? { positive: 0, neutral: 0, negative: 0 });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(job: "sync" | "score" | "insight") {
    setBusy(job);
    setNote("");
    try {
      if (job === "sync") {
        // Trends is fetched a few keywords at a time (see the route): keep
        // asking for the next slice until it says there is none, so the
        // person presses once and the whole list gets done.
        let offset: number | null = 0;
        let reviews = 0;
        let points = 0;
        const failed: string[] = [];
        while (offset !== null) {
          const res = await fetch(`/api/admin/brand-signals?offset=${offset}`, { method: "POST" });
          const data = await res.json().catch(() => null);
          if (!data?.ok) {
            setNote(data?.error || "ซิงก์ไม่สำเร็จ");
            return;
          }
          reviews += data.ownReviews?.synced ?? 0;
          points += data.googleTrends?.synced ?? 0;
          failed.push(...(data.googleTrends?.failed ?? []));
          setNote(`กำลังซิงก์… ${Math.min(data.offset + 5, data.total)}/${data.total} คำ`);
          offset = data.nextOffset;
        }
        setNote(
          `ซิงก์แล้ว — รีวิว ${reviews} รายการ, Google Trends ${points} จุด` +
            (failed.length > 0 ? ` · ดึงไม่สำเร็จ ${failed.length} คำ: ${failed.join(", ")}` : "")
        );
        await load();
        return;
      }

      const res = await fetch(`/api/admin/brand-insights?job=${job}`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setNote(data?.error || "ทำงานไม่สำเร็จ");
        return;
      }
      setNote(job === "score" ? `คำนวณโอกาสแล้ว ${data.scored} คำ` : "สรุปข้อมูลใหม่แล้ว");
      await load();
    } finally {
      setBusy("");
    }
  }

  useAdminAction({
    label: busy === "sync" ? "กำลังซิงก์…" : "ซิงก์ข้อมูลใหม่",
    disabled: Boolean(busy),
    onClick: () => run("sync"),
  });


  const latest = insights[0];
  const totalReviews = sentiment.positive + sentiment.neutral + sentiment.negative;
  const pct = (n: number) => (totalReviews > 0 ? Math.round((n / totalReviews) * 100) : 0);

  // The four figures at the top, each one a real count rather than a score.
  const mentions = breakdown.reduce((sum, r) => sum + r.total, 0);
  const negatives = breakdown.reduce((sum, r) => sum + r.negative, 0);
  const loudest = [...breakdown].sort((a, b) => b.total - a.total)[0];
  const top = opportunities[0];
  const zeroResults = opportunities.reduce((sum, o) => sum + o.site_searches_without_results, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-ink md:text-2xl">สัญญาณแบรนด์ &amp; โอกาส SEO</h1>
          <p className="mt-1 text-sm text-slate-500">
            รวมสิ่งที่วัดได้จริงจากข้อมูลของร้านเอง — รีวิวบนเว็บ, ความสนใจค้นหาใน Google Trends และคำที่คนค้นในเว็บนี้
          </p>
        </div>
      </div>

      {note && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-brand-gradient-soft px-4 py-2.5 text-sm text-brand-ink">
          <RefreshCw size={14} className={"mt-0.5 shrink-0 " + (busy ? "animate-spin" : "")} aria-hidden="true" />
          {note}
        </p>
      )}

      {/* The short answer, before any panel: four counts, no scores. */}
      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          icon={ThumbsUp}
          label="รีวิวบนเว็บ"
          value={totalReviews.toLocaleString("th-TH")}
          sub={totalReviews > 0 ? `บวก ${sentiment.positive} · ลบ ${sentiment.negative}` : "ยังไม่มีรีวิวที่อนุมัติ"}
          tone={totalReviews === 0 ? "muted" : "good"}
        />
        <Stat
          icon={MessageSquare}
          label="เสียงที่ระบุสินค้า (30 วัน)"
          value={mentions.toLocaleString("th-TH")}
          sub={loudest ? `พูดถึงมากสุด: ${loudest.keyword}` : "ยังไม่มีสัญญาณที่ระบุสินค้า"}
          tone={negatives > 0 ? "bad" : "muted"}
        />
        <Stat
          icon={Search}
          label="ค้นในเว็บแล้วไม่เจอ"
          value={zeroResults.toLocaleString("th-TH")}
          sub={zeroResults > 0 ? "คำที่คนพิมพ์แล้วไม่มีสินค้าขึ้น" : "ยังไม่พบคำที่ค้นแล้วไม่เจอ"}
          tone={zeroResults > 0 ? "warn" : "muted"}
        />
        <Stat
          icon={Target}
          label="โอกาสสูงสุดตอนนี้"
          value={top ? `${top.opportunity_percent}%` : "—"}
          sub={top ? top.keyword : "ยังไม่เคยคำนวณ"}
          tone={top ? "good" : "muted"}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* What the AI read out of it — the longest text on the page, so it
            gets the wider column. */}
        <section className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-brand-ink">ประเด็นที่พบ</h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => run("insight")} disabled={Boolean(busy)}>
              <Sparkles size={14} aria-hidden="true" />
              {busy === "insight" ? "กำลังสรุป…" : "ให้ AI สรุปใหม่"}
            </Button>
          </div>
          {!latest ? (
            <p className="mt-2 rounded-xl2 bg-surface-soft p-5 text-sm text-slate-500">
              ยังไม่เคยสรุป — กด &ldquo;ให้ AI สรุปใหม่&rdquo; เมื่อมีข้อมูลพอแล้ว
            </p>
          ) : (
            <div className="mt-2 rounded-xl2 bg-white p-5 ring-1 ring-surface-line">
              <p className="text-xs text-slate-400">
                {latest.period_start} ถึง {latest.period_end} · อ่านจาก{" "}
                {latest.signals_considered.toLocaleString("th-TH")} สัญญาณ
              </p>
              {latest.summary && (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-ink">{latest.summary}</p>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ThemeList
                  title="จุดที่ลูกค้าชม"
                  items={latest.positive_themes ?? []}
                  className="bg-emerald-50/70 text-emerald-800"
                />
                <ThemeList
                  title="จุดที่ต้องแก้"
                  items={latest.negative_themes ?? []}
                  className="bg-rose-50/70 text-rose-800"
                />
              </div>
              {(latest.recommendations ?? []).length > 0 && (
                <div className="mt-3 rounded-lg bg-surface-soft p-4">
                  <p className="text-xs font-semibold text-brand-800">ข้อเสนอแนะ</p>
                  <ol className="mt-1.5 space-y-1.5 text-sm text-slate-600">
                    {(latest.recommendations ?? []).map((t, i) => (
                      <li key={t} className="flex gap-2">
                        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand-800 text-[10px] font-bold text-white">
                          {i + 1}
                        </span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </section>

        {/* The two counted panels, stacked in the narrower column: how people
            feel overall, and which product they were talking about. */}
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="text-sm font-bold text-brand-ink">ความรู้สึกจากรีวิวบนเว็บ</h2>
            {totalReviews === 0 ? (
              <p className="mt-2 rounded-xl2 bg-surface-soft p-5 text-sm text-slate-500">
                ยังไม่มีรีวิวที่อนุมัติแล้วในระบบ — กด &ldquo;ซิงก์ข้อมูลใหม่&rdquo; หลังจากมีรีวิวเข้ามา
              </p>
            ) : (
              <div className="mt-2 rounded-xl2 bg-white p-5 ring-1 ring-surface-line">
                <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted">
                  <div className="bg-emerald-500" style={{ width: `${pct(sentiment.positive)}%` }} />
                  <div className="bg-slate-300" style={{ width: `${pct(sentiment.neutral)}%` }} />
                  <div className="bg-rose-400" style={{ width: `${pct(sentiment.negative)}%` }} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["บวก", sentiment.positive, "text-emerald-600"],
                    ["กลาง", sentiment.neutral, "text-slate-500"],
                    ["ลบ", sentiment.negative, "text-rose-600"],
                  ].map(([label, n, colour]) => (
                    <div key={label as string} className="rounded-lg bg-surface-soft py-2">
                      <dt className="text-[11px] text-slate-500">{label}</dt>
                      <dd className={"text-base font-bold tabular-nums " + colour}>{n as number}</dd>
                    </div>
                  ))}
                </dl>
                {totalReviews < 30 && (
                  <p className="mt-2 text-xs text-slate-400">
                    จาก {totalReviews} รีวิว — ยังน้อยเกินกว่าจะถือเป็นภาพรวมของแบรนด์
                  </p>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-bold text-brand-ink">ปัญหาแยกตามสินค้า</h2>
            <p className="mt-1 text-xs text-slate-500">
              นับจากรีวิวและแชทที่ระบุสินค้าไว้ชัดเจน (30 วันล่าสุด) — เรียงจากลบมากไปน้อย ไม่ใช่ให้ AI เดา
            </p>
            {breakdown.length === 0 ? (
              <p className="mt-2 rounded-xl2 bg-surface-soft p-5 text-sm text-slate-500">
                ยังไม่มีสัญญาณที่ระบุสินค้าไว้ในช่วงนี้
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-surface-line/60 rounded-xl2 bg-white ring-1 ring-surface-line">
                {breakdown.slice(0, 30).map((row, i) => (
                  <li key={row.keyword} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-7 shrink-0 pr-1.5 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <Link
                        href={`/product/${row.keyword}`}
                        target="_blank"
                        className="block truncate text-sm font-medium text-brand-ink hover:text-brand-800"
                        title={row.keyword}
                      >
                        {row.keyword}
                      </Link>
                      {/* One bar instead of five columns of zeros: the shape
                          says what the mix is, the tooltip says the numbers.
                          When nothing was classified the bar would be pure
                          background, which reads as "still loading" — so the
                          row says so in words instead. */}
                      {row.negative + row.positive + row.neutral > 0 ? (
                        <span
                          className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-muted"
                          title={`ลบ ${row.negative} · บวก ${row.positive} · กลาง ${row.neutral} · พูดถึง ${row.unclassified}`}
                        >
                          <span className="bg-rose-400" style={{ width: `${(row.negative / row.total) * 100}%` }} />
                          <span className="bg-emerald-500" style={{ width: `${(row.positive / row.total) * 100}%` }} />
                          <span className="bg-slate-300" style={{ width: `${(row.neutral / row.total) * 100}%` }} />
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-[11px] text-slate-400">พูดถึงเฉย ๆ ยังไม่ระบุความรู้สึก</span>
                      )}
                    </span>
                    {row.negative > 0 && (
                      <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">
                        ลบ {row.negative}
                      </span>
                    )}
                    <span className="w-8 shrink-0 text-right text-sm tabular-nums text-slate-500">{row.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Where the next afternoon goes. Full width: six columns, one of them
          a whole sentence. */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-brand-ink">
            โอกาส SEO <span className="font-normal text-slate-400">({opportunities.length})</span>
          </h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => run("score")} disabled={Boolean(busy)}>
            <RefreshCw size={14} aria-hidden="true" />
            {busy === "score" ? "กำลังคำนวณ…" : "คำนวณใหม่"}
          </Button>
        </div>

        <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            ตัวเลขนี้คือ &ldquo;ควรลงแรงกับคำไหนก่อน&rdquo; ไม่ใช่ &ldquo;โอกาสติดอันดับ&rdquo; — ยังไม่ได้ต่อ Search Console
            จึงยังไม่รู้อันดับจริงของเรา และช่อง &ldquo;การแข่งขัน&rdquo; เป็นการประเมินจากรูปแบบของคำ ไม่ใช่การวัดหน้าผลค้นหาจริง
          </span>
        </p>

        {opportunities.length === 0 ? (
          <p className="mt-2 rounded-xl2 bg-surface-soft p-5 text-sm text-slate-500">
            ยังไม่เคยคำนวณ — ซิงก์ข้อมูลก่อน แล้วกด &ldquo;คำนวณใหม่&rdquo;
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl2 bg-white ring-1 ring-surface-line">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-surface-line text-left text-xs text-slate-400">
                  <th className="w-10 py-2.5 pl-4 font-medium">#</th>
                  <th className="py-2.5 pr-3 font-medium">คำค้นหา</th>
                  <th className="w-40 py-2.5 pr-3 font-medium">โอกาส</th>
                  <th className="w-20 py-2.5 pr-3 font-medium">Trends</th>
                  <th className="w-28 py-2.5 pr-3 font-medium">ค้นในเว็บ</th>
                  <th className="w-24 py-2.5 pr-3 font-medium">การแข่งขัน</th>
                  <th className="py-2.5 pr-4 font-medium">ควรทำอะไร</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o, i) => (
                  <tr key={o.keyword} className="border-b border-surface-line/60 last:border-0 hover:bg-surface-soft/60">
                    <td className="py-2.5 pl-4 text-xs tabular-nums text-slate-400">{i + 1}</td>
                    <td className="py-2.5 pr-3 font-medium text-brand-ink">
                      {o.page_slug && o.page_type ? (
                        <Link
                          href={o.page_type === "concern" ? `/concern/${o.page_slug}` : `/shop/${o.page_slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 hover:text-brand-800"
                        >
                          {o.keyword} <ArrowUpRight size={12} aria-hidden="true" />
                        </Link>
                      ) : (
                        o.keyword
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted">
                          <span
                            className="block h-full rounded-full bg-brand-gradient"
                            style={{ width: `${o.opportunity_percent}%` }}
                          />
                        </span>
                        <span className="tabular-nums text-xs font-semibold text-slate-600">
                          {o.opportunity_percent}%
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-xs text-slate-500">
                      {o.search_volume_estimate ?? <span title="Google Trends ไม่มีข้อมูลสำหรับคำนี้">ไม่มีข้อมูล</span>}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-xs text-slate-500">
                      {o.site_searches}
                      {o.site_searches_without_results > 0 && (
                        <span className="ml-1 text-amber-700">({o.site_searches_without_results} ไม่เจอ)</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-500">{COMPETITION_TH[o.competition_level]}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">{o.recommended_action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const TONES = {
  good: "text-emerald-600",
  bad: "text-rose-600",
  warn: "text-amber-600",
  muted: "text-slate-300",
} as const;

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof MessageSquare;
  label: string;
  value: string;
  sub: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl2 bg-white p-4 ring-1 ring-surface-line">
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <Icon size={13} className={TONES[tone]} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-brand-ink">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-slate-400" title={sub}>
        {sub}
      </p>
    </div>
  );
}

function ThemeList({ title, items, className }: { title: string; items: string[]; className: string }) {
  return (
    <div className={"rounded-lg p-3 " + className}>
      <p className="text-xs font-semibold">{title}</p>
      <ul className="mt-1.5 space-y-1 text-sm text-slate-600">
        {items.map((t) => (
          <li key={t} className="flex gap-1.5">
            <span aria-hidden="true">•</span>
            <span>{t}</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-slate-400">—</li>}
      </ul>
    </div>
  );
}
