"use client";

import Link from "next/link";
import { Camera, ChevronRight, Loader2, ScanFace } from "lucide-react";
import AccountLayout from "@/components/account/AccountLayout";
import SkinProgress from "@/components/skin-coach/SkinProgress";
import { formatScanDate, useScanHistory } from "@/components/skin-coach/ScanHistory";
import { careAreas, scanScore, scoreTone } from "@/lib/skin-scan-summary";
import { healthBand } from "@/lib/skin-analysis";
import type { SkinScanRow } from "@/app/api/skin-coach/history/route";

// Every scan the member chose to save, newest first, so they can come back to
// a result instead of it living only on the page they scanned on. Each one
// opens in full; the chart below shows the trend across them.

function ScoreBadge({ score }: { score: number }) {
  const band = healthBand(score);
  return (
    <span className="flex flex-col items-end">
      <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: band.color }}>
        {score}
      </span>
      <span className="mt-1 text-[11px] text-slate-500">คะแนนผิว</span>
    </span>
  );
}

function ScanCard({ scan, previous }: { scan: SkinScanRow; previous?: SkinScanRow }) {
  const score = scanScore(scan);
  const diff = previous ? score - scanScore(previous) : null;
  const care = careAreas(scan, 2);
  return (
    <li>
      <Link
        href={`/account/skin-scans/${scan.id}`}
        className="flex items-center gap-3.5 rounded-xl2 border border-slate-100 bg-white p-3.5 shadow-card transition-colors hover:border-brand-teal"
      >
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-mist">
          {scan.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={scan.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-brand-800/60">
              <ScanFace size={26} aria-hidden="true" />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-brand-ink">{formatScanDate(scan.scanned_at)}</span>
          <span className="mt-0.5 block text-xs text-slate-600">
            อายุผิว {scan.skin_age} ปี
            {diff !== null && (
              <>
                {" · "}
                <span className={diff > 0 ? "font-semibold text-brand-800" : diff < 0 ? "font-semibold text-amber-800" : ""}>
                  {diff > 0 ? `ดีขึ้น +${diff}` : diff < 0 ? `ลดลง ${diff}` : "เท่าเดิม"}
                </span>
                <span className="text-slate-500"> จากครั้งก่อน</span>
              </>
            )}
          </span>
          {care.length > 0 ? (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {care.map((a) => (
                <span key={a.key} className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-inset ring-surface-line">
                  <span className={scoreTone(a.score)}>●</span> {a.label} {a.score}
                </span>
              ))}
            </span>
          ) : (
            <span className="mt-1.5 block text-[11px] text-brand-800">ทุกด้านอยู่ในเกณฑ์ดี</span>
          )}
        </span>

        <ScoreBadge score={score} />
        <ChevronRight size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
      </Link>
    </li>
  );
}

function SkinScansContent() {
  const history = useScanHistory({ all: true });
  const { scans, loaded } = history;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">ผลสแกนผิวของฉัน</h1>
          <p className="mt-1 text-sm text-slate-600">ผลที่คุณกดบันทึกไว้ เปิดดูย้อนหลังและเทียบพัฒนาการได้</p>
        </div>
        <Link
          href="/skin-coach"
          className="flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          <Camera size={15} aria-hidden="true" /> สแกนผิวใหม่
        </Link>
      </div>

      {!loaded ? (
        <div className="grid place-items-center py-16 text-slate-500">
          <Loader2 size={22} className="animate-spin" aria-label="กำลังโหลด" />
        </div>
      ) : scans.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-surface-line px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
            <ScanFace size={22} aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-bold text-brand-ink">ยังไม่มีผลสแกนที่บันทึกไว้</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-600">
            สแกนผิวแล้วกด &quot;บันทึกผล&quot; ในหน้าผลลัพธ์ ผลจะมาอยู่ที่นี่ให้กลับมาดูและเทียบได้ทุกครั้ง
          </p>
          <Link href="/skin-coach" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-800">
            <Camera size={14} aria-hidden="true" /> เริ่มสแกนผิว
          </Link>
        </div>
      ) : (
        <>
          <h2 className="mb-3 text-sm font-bold text-brand-ink">ประวัติการสแกน ({scans.length})</h2>
          <ul className="flex flex-col gap-3">
            {scans.map((scan, i) => (
              <ScanCard key={scan.id} scan={scan} previous={scans[i + 1]} />
            ))}
          </ul>

          <section className="mt-8 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
            <SkinProgress scans={scans} onPhotosRemoved={history.reload} />
          </section>
        </>
      )}
    </div>
  );
}

export default function SkinScansPage() {
  return (
    <AccountLayout>
      <SkinScansContent />
    </AccountLayout>
  );
}
