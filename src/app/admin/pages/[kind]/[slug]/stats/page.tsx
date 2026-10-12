"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Loader2 } from "lucide-react";

import { Card } from "@/components/ui";

// What people pressed on this page.
//
// Presses, not visitors. The counter behind this screen records a section id,
// a date and a number — nothing about who — so this page can say which
// section gets used and cannot say how many people used it. Saying that out
// loud on the screen matters more than it looks: a number labelled
// ambiguously gets read as whatever the reader hoped it meant.

type Row = { id: string; clicks: number; label: string | null; gone: boolean };
type Stats = {
  days: number;
  title: string;
  total: number;
  sections: Row[];
  daily: { day: string; clicks: number }[];
};

export default function PageStats(props: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = use(props.params);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/pages/${kind}/${slug}/stats`);
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error ?? "โหลดสถิติไม่สำเร็จ");
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "โหลดสถิติไม่สำเร็จ");
      }
    })();
  }, [kind, slug]);

  if (error) return <p className="py-10 text-center text-sm text-rose-600">{error}</p>;
  if (!stats) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> กำลังโหลด…
      </p>
    );
  }

  const busiest = Math.max(1, ...stats.sections.map((s) => s.clicks));
  const busiestDay = Math.max(1, ...stats.daily.map((d) => d.clicks));

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/admin/pages/${kind}/${slug}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-800"
      >
        <ArrowLeft size={15} /> กลับไปแก้หน้านี้
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-ink">
          <BarChart3 size={20} /> สถิติ · {stats.title}
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          นับ &quot;จำนวนครั้งที่กด&quot; ในแต่ละ section ย้อนหลัง {stats.days} วัน (เวลาไทย) ·
          ไม่ได้นับจำนวนคน และไม่ได้เก็บว่าใครกด — ตัวเลขนี้จึงบอกได้ว่า section ไหนถูกใช้ ไม่ได้บอกว่ามีคนเข้ากี่คน
        </p>
      </div>

      {stats.total === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-500">
            ยังไม่มีการกดในช่วง {stats.days} วันที่ผ่านมา — ถ้าเพิ่งเผยแพร่ ตัวเลขจะเริ่มขึ้นหลังมีคนเข้าหน้านี้
          </p>
        </Card>
      ) : (
        <>
          <Card padded={false}>
            <div className="flex items-baseline justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-brand-ink">กดทั้งหมดในหน้านี้</h2>
              <span className="text-lg font-bold text-brand-800">{stats.total.toLocaleString("th-TH")} ครั้ง</span>
            </div>
            <ul className="flex flex-col gap-2 p-4">
              {stats.sections.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-[2] truncate text-[13px] text-brand-ink">
                    {s.label ?? s.id}
                    {s.gone && <span className="ml-1.5 text-[11px] text-slate-400">(เอาออกจากหน้าแล้ว)</span>}
                  </span>
                  {/* A bar rather than only a number: the question is almost
                      always "which one", and a row of numbers makes the eye
                      do the comparing. */}
                  <span className="h-2.5 flex-[3] overflow-hidden rounded-full bg-surface-soft">
                    <span
                      className="block h-full rounded-full bg-brand-gradient"
                      style={{ width: `${Math.max(2, (s.clicks / busiest) * 100)}%` }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right text-[13px] font-semibold tabular-nums text-brand-ink">
                    {s.clicks.toLocaleString("th-TH")}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card padded={false}>
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-brand-ink">รายวัน</h2>
            <ul className="flex h-40 items-end gap-1 px-4 py-4">
              {stats.daily.map((d) => (
                <li
                  key={d.day}
                  title={`${new Date(d.day).toLocaleDateString("th-TH")} · ${d.clicks} ครั้ง`}
                  className="min-w-0 flex-1 rounded-t bg-brand-gradient-soft"
                  style={{ height: `${Math.max(4, (d.clicks / busiestDay) * 100)}%` }}
                >
                  <span className="sr-only">
                    {new Date(d.day).toLocaleDateString("th-TH")}: {d.clicks} ครั้ง
                  </span>
                </li>
              ))}
            </ul>
            <p className="px-4 pb-3 text-[12px] text-slate-400">
              {stats.daily.length > 0 &&
                `${new Date(stats.daily[0].day).toLocaleDateString("th-TH")} – ${new Date(
                  stats.daily[stats.daily.length - 1].day
                ).toLocaleDateString("th-TH")}`}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
