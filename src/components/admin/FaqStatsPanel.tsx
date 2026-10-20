"use client";

import { useEffect, useState } from "react";
import { BarChart3, ThumbsUp, ThumbsDown, Search, HelpCircle } from "lucide-react";
import Link from "next/link";
import { Panel } from "@/components/admin/layout-kit";

// Five numbers about whether the FAQ centre is doing its job.
//
// Deliberately not a dashboard. Each block answers one question somebody
// asks out loud — what do people read, what did they find useless, what do
// they search for, what do they search for and not find, how often did the
// assistant have an approved answer — and a chart that answered none of
// those would be decoration.

type Voted = { title: string; slug: string | null; up: number; down: number };
type Popular = { q: string; hits: number; empty: number };

type Stats = {
  days: number;
  helpful: Voted[];
  unhelpful: Voted[];
  popular: Popular[];
  gaps: { q: string; hits: number }[];
  assistant: { turns: number; askedKb: number; answeredFromKb: number; pct: number | null };
};

export default function FaqStatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/kb/stats")
      .then((r) => r.json())
      .then((d) => (d.ok ? setStats(d) : setError(d.error || "โหลดสถิติไม่สำเร็จ")))
      .catch(() => setError("โหลดสถิติไม่สำเร็จ"));
  }, []);

  if (error) return <p className="rounded-lg bg-rose-50 p-3 text-[13px] text-rose-700">{error}</p>;
  if (!stats) return <p className="p-4 text-sm text-slate-500">กำลังโหลด…</p>;

  const a = stats.assistant;

  return (
    <div className="space-y-4">
      <Panel title={`น้อง Smoothie ตอบจากคำตอบที่อนุมัติแล้วแค่ไหน (${stats.days} วันล่าสุด)`} icon={<BarChart3 size={15} className="text-brand-emerald" />} padded>
        {a.askedKb === 0 ? (
          <p className="text-[13px] text-slate-500">ยังไม่มีเทิร์นที่ค้นคลังความรู้ในช่วงนี้</p>
        ) : (
          <>
            <p className="text-3xl font-bold tabular-nums text-brand-ink">{a.pct}%</p>
            <p className="mt-1 text-[13px] text-slate-600">
              จาก {a.askedKb} เทิร์นที่ค้นคลังความรู้ เจอคำตอบ {a.answeredFromKb} เทิร์น
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              ทั้งหมด {a.turns} เทิร์น · ที่เหลือ {a.turns - a.askedKb} เทิร์นไม่ได้ค้นคลังเลย ซึ่งเป็นคนละปัญหากับ “ค้นแล้วไม่เจอ”
              และแก้คนละวิธี
            </p>
          </>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="คำตอบที่คนบอกว่ามีประโยชน์" icon={<ThumbsUp size={15} className="text-brand-emerald" />} padded>
          <StatList rows={stats.helpful} field="up" empty="ยังไม่มีใครโหวต" />
        </Panel>

        <Panel title="คำตอบที่คนบอกว่าไม่ช่วย" icon={<ThumbsDown size={15} className="text-brand-emerald" />} padded>
          <StatList rows={stats.unhelpful} field="down" empty="ยังไม่มีใครกดไม่ช่วย" />
        </Panel>

        <Panel title="คำที่คนค้นบ่อย" icon={<Search size={15} className="text-brand-emerald" />} padded>
          {stats.popular.length === 0 ? (
            <p className="text-[13px] text-slate-500">ยังไม่มีการค้นหาในช่วงนี้</p>
          ) : (
            <ul className="space-y-1.5">
              {stats.popular.map((p) => (
                <li key={p.q} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-brand-ink">{p.q}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {p.hits}
                    {p.empty > 0 && <span className="ml-1 text-amber-700">· ไม่เจอ {p.empty}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="คำถามที่ยังไม่มีคำตอบ ถามบ่อยสุด" icon={<HelpCircle size={15} className="text-brand-emerald" />} padded>
          {stats.gaps.length === 0 ? (
            <p className="text-[13px] text-slate-500">คิวว่าง</p>
          ) : (
            <ul className="space-y-1.5">
              {stats.gaps.map((g) => (
                <li key={g.q} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-brand-ink">{g.q}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">{g.hits}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StatList({ rows, field, empty }: { rows: Voted[]; field: "up" | "down"; empty: string }) {
  if (rows.length === 0) return <p className="text-[13px] text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.title} className="flex items-baseline justify-between gap-3 text-[13px]">
          {r.slug ? (
            <Link href={`/faq/${encodeURIComponent(r.slug)}`} className="min-w-0 truncate text-brand-ink hover:underline">
              {r.title}
            </Link>
          ) : (
            <span className="min-w-0 truncate text-brand-ink">{r.title}</span>
          )}
          <span className="shrink-0 tabular-nums text-slate-500">
            👍 {r.up} · 👎 {r.down}
            <span className="sr-only">{field === "up" ? "มีประโยชน์" : "ไม่ช่วย"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
