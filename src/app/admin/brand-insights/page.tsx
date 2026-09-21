"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Sparkles, ArrowUpRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { useAdminAction } from "@/components/admin/header-action";

// What the brand's own signals say, and which keyword is worth the next
// afternoon. Three panels, in the order the questions get asked: how do
// people feel, what do they keep saying, and what should we do about it.

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

  return (
    <div>
      <h1 className="text-xl font-bold text-brand-ink md:text-2xl">สัญญาณแบรนด์ & โอกาส SEO</h1>
      <p className="mt-1 text-sm text-slate-500">
        รวมสิ่งที่วัดได้จริงจากข้อมูลของร้านเอง — รีวิวบนเว็บ, ความสนใจค้นหาใน Google Trends และคำที่คนค้นในเว็บนี้
      </p>

      {note && <p className="mt-3 rounded-lg bg-surface-soft px-4 py-2.5 text-sm text-slate-600">{note}</p>}

      {/* 1 — sentiment */}
      <section className="mt-6">
        <h2 className="text-sm font-bold text-brand-ink">ความรู้สึกจากรีวิวบนเว็บ</h2>
        {totalReviews === 0 ? (
          <p className="mt-2 rounded-xl2 bg-surface-soft p-5 text-sm text-slate-500">
            ยังไม่มีรีวิวที่อนุมัติแล้วในระบบ — กด &ldquo;ซิงก์ข้อมูลใหม่&rdquo; หลังจากมีรีวิวเข้ามา
          </p>
        ) : (
          <>
            <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-muted">
              <div className="bg-emerald-500" style={{ width: `${pct(sentiment.positive)}%` }} />
              <div className="bg-slate-300" style={{ width: `${pct(sentiment.neutral)}%` }} />
              <div className="bg-rose-400" style={{ width: `${pct(sentiment.negative)}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              บวก {sentiment.positive} · กลาง {sentiment.neutral} · ลบ {sentiment.negative} (จาก {totalReviews} รีวิว)
              {totalReviews < 30 && " — ยังน้อยเกินกว่าจะถือเป็นภาพรวมของแบรนด์"}
            </p>
          </>
        )}
      </section>

      {/* 2 — what the AI read out of it */}
      <section className="mt-8">
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
              {latest.period_start} ถึง {latest.period_end} · อ่านจาก {latest.signals_considered.toLocaleString("th-TH")} สัญญาณ
            </p>
            {latest.summary && <p className="mt-2 whitespace-pre-line text-sm text-brand-ink">{latest.summary}</p>}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-emerald-700">จุดที่ลูกค้าชม</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                  {(latest.positive_themes ?? []).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                  {(latest.positive_themes ?? []).length === 0 && <li className="list-none text-slate-400">—</li>}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-rose-700">จุดที่ต้องแก้</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                  {(latest.negative_themes ?? []).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                  {(latest.negative_themes ?? []).length === 0 && <li className="list-none text-slate-400">—</li>}
                </ul>
              </div>
            </div>
            {(latest.recommendations ?? []).length > 0 && (
              <div className="mt-4 rounded-lg bg-surface-soft p-4">
                <p className="text-xs font-semibold text-brand-800">ข้อเสนอแนะ</p>
                <ul className="mt-1 list-inside list-decimal space-y-1 text-sm text-slate-600">
                  {(latest.recommendations ?? []).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3 — counted, not narrated: which product this is actually about */}
      <section className="mt-8">
        <h2 className="text-sm font-bold text-brand-ink">ปัญหาแยกตามสินค้า</h2>
        <p className="mt-1 text-xs text-slate-500">
          นับจากรีวิวและแชทที่ระบุสินค้าไว้ชัดเจนเท่านั้น (30 วันล่าสุด) — เรียงจากลบมากไปน้อย ใช้หาว่าควรแก้ตัวไหนก่อน
          ไม่ใช่ให้ AI เดา
        </p>
        {breakdown.length === 0 ? (
          <p className="mt-2 rounded-xl2 bg-surface-soft p-5 text-sm text-slate-500">
            ยังไม่มีสัญญาณที่ระบุสินค้าไว้ในช่วงนี้
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-surface-line text-left text-xs text-slate-400">
                  <th className="pb-2 font-medium">สินค้า</th>
                  <th className="pb-2 font-medium">ลบ</th>
                  <th className="pb-2 font-medium">บวก</th>
                  <th className="pb-2 font-medium">กลาง</th>
                  <th className="pb-2 font-medium">พูดถึง (ไม่ระบุความรู้สึก)</th>
                  <th className="pb-2 font-medium">รวม</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.slice(0, 30).map((row) => (
                  <tr key={row.keyword} className="border-b border-surface-line/60">
                    <td className="py-2.5 pr-3 font-medium text-brand-ink">
                      <Link
                        href={`/product/${row.keyword}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 hover:text-brand-800"
                      >
                        {row.keyword} <ArrowUpRight size={12} aria-hidden="true" />
                      </Link>
                    </td>
                    <td className={"py-2.5 pr-3 tabular-nums " + (row.negative > 0 ? "font-semibold text-rose-600" : "text-slate-400")}>
                      {row.negative}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-500">{row.positive}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-500">{row.neutral}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-500">{row.unclassified}</td>
                    <td className="py-2.5 tabular-nums text-slate-500">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4 — where the next afternoon goes */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-brand-ink">โอกาส SEO</h2>
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
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-surface-line text-left text-xs text-slate-400">
                  <th className="pb-2 font-medium">คำค้นหา</th>
                  <th className="pb-2 font-medium">โอกาส</th>
                  <th className="pb-2 font-medium">Trends</th>
                  <th className="pb-2 font-medium">ค้นในเว็บ</th>
                  <th className="pb-2 font-medium">การแข่งขัน</th>
                  <th className="pb-2 font-medium">ควรทำอะไร</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o) => (
                  <tr key={o.keyword} className="border-b border-surface-line/60">
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
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
                          <span
                            className="block h-full rounded-full bg-brand-gradient"
                            style={{ width: `${o.opportunity_percent}%` }}
                          />
                        </span>
                        <span className="tabular-nums text-xs text-slate-600">{o.opportunity_percent}%</span>
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
                    <td className="py-2.5 text-xs text-slate-600">{o.recommended_action}</td>
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
