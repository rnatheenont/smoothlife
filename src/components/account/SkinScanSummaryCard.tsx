"use client";

import Link from "next/link";
import { ChevronRight, ScanFace } from "lucide-react";
import { formatScanDate, useScanHistory } from "@/components/skin-coach/ScanHistory";
import { careAreas, scanScore } from "@/lib/skin-scan-summary";
import { healthBand } from "@/lib/skin-analysis";

// Saved-scan summary. Lives beside the "scan now" tiles so everything about a
// member's skin is one section of the account page rather than two.
export default function SkinScanSummaryCard() {
  const { scans, loaded } = useScanHistory();
  if (!loaded) return null;
  const latest = scans[0];
  if (!latest) {
    return (
      <Link href="/skin-coach" className="rounded-xl2 border border-slate-100 bg-white shadow-card p-5 flex items-center gap-3 group">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
          <ScanFace size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-brand-ink">ยังไม่มีผลสแกนผิว</p>
          <p className="text-xs text-slate-500">สแกนผิวฟรี แล้วกดบันทึกผล เพื่อกลับมาดูและเทียบพัฒนาการได้</p>
        </div>
        <ChevronRight size={16} className="text-slate-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    );
  }
  const score = scanScore(latest);
  const band = healthBand(score);
  const care = careAreas(latest, 2);
  return (
    <Link href="/account/skin-scans" className="rounded-xl2 border border-slate-100 bg-white shadow-card p-5 flex items-center gap-4 group">
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-mist">
        {latest.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={latest.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-brand-800/60">
            <ScanFace size={24} />
          </span>
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">
          ผลล่าสุด {formatScanDate(latest.scanned_at)} · บันทึกไว้ {scans.length} ครั้ง
        </p>
        <p className="text-sm font-bold text-brand-ink">
          คะแนนผิว <span style={{ color: band.color }}>{score}</span> · อายุผิว {latest.skin_age} ปี
        </p>
        <p className="text-xs text-slate-500 truncate">
          {care.length ? `ควรดูแล: ${care.map((a) => a.label).join(", ")}` : "ทุกด้านอยู่ในเกณฑ์ดี"}
        </p>
      </div>
      <span className="hidden sm:inline text-xs font-semibold text-brand-800 shrink-0">ดูทั้งหมด</span>
      <ChevronRight size={16} className="text-slate-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}
