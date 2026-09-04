"use client";

import { RotateCcw, Sparkles, CalendarClock, Info } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { useQuickChat } from "@/lib/quickchat-context";
import ShareCard from "@/components/skin-coach/ShareCard";
import RewardClaim from "@/components/skin-coach/RewardClaim";
import {
  SkinCoachMetrics,
  topConcerns,
  concernLabel,
  productsForConcern,
  overallScore,
  scoreBand as sharedScoreBand,
} from "@/lib/skin-coach";
import { Button } from "@/components/ui";

function MetricRow({ label, score }: { label: string; score: number }) {
  const clarity = Math.max(0, Math.min(100, 100 - score));
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{label}</span>
        <span className="font-semibold text-brand-ink">{clarity}/100</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-brand-gradient rounded-full" style={{ width: `${clarity}%` }} />
      </div>
    </div>
  );
}

export default function ResultsView({
  metrics,
  photo,
  zones,
  onRestart,
}: {
  metrics: SkinCoachMetrics;
  photo: string | null;
  zones: string[];
  onRestart: () => void;
}) {
  const concerns = topConcerns(metrics, 2);
  const { openWithProfile } = useQuickChat();
  const total = overallScore(metrics);
  const band = sharedScoreBand(total);
  const circumference = 2 * Math.PI * 42;
  const dash = (total / 100) * circumference;

  function askAdvisor() {
    const info = concerns.map((slug) => concernLabel(slug)?.nameTh).filter(Boolean).join(", ");
    openWithProfile({
      scan: `คะแนนผิวรวม ${total}/100`,
      concern: info || "สุขภาพผิวโดยรวม",
    });
  }

  return (
    <div className="max-w-3xl mx-auto lg:max-w-none">
      <div className="rounded-xl2 border border-slate-100 shadow-card p-5 sm:p-7 lg:p-8 mb-6">
        <h2 className="font-bold text-brand-ink mb-5 text-lg sm:text-xl">ผลสแกนผิวของคุณ</h2>

        <div className="flex flex-col sm:flex-row items-center gap-6 mb-6 pb-6 border-b border-slate-100">
          <div className="relative h-28 w-28 sm:h-32 sm:w-32 shrink-0">
            <svg viewBox="0 0 100 100" className="h-28 w-28 sm:h-32 sm:w-32 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={band.hex}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl sm:text-3xl font-bold text-brand-ink leading-none">{total}</span>
              <span className="text-[10px] text-slate-400">/100</span>
            </div>
          </div>
          <div className="text-center sm:text-left">
            <span
              className="inline-block text-xs font-semibold rounded-full px-3 py-1 mb-2"
              style={{ color: band.hex, backgroundColor: `${band.hex}1a` }}
            >
              {band.label}
            </span>
            <p className="text-sm text-slate-600">{metrics.overallNote}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl2 bg-brand-gradient-soft p-5 mb-6">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-brand-emerald">
            <CalendarClock size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500">อายุผิวโดยประมาณ</p>
            <p className="text-3xl font-extrabold text-brand-ink leading-tight">{metrics.skinAge.years} ปี</p>
            <p className="text-xs text-brand-emerald mt-0.5">{metrics.skinAge.note}</p>
          </div>
        </div>

        <div className="sm:grid sm:grid-cols-2 sm:gap-x-8">
          <MetricRow label="ความเรียบเนียน (สิว)" score={metrics.acne.score} />
          <MetricRow label="ความละเอียดของรูขุมขน" score={metrics.pores.score} />
          <MetricRow label="ความสม่ำเสมอของสีผิว (จุดด่างดำ)" score={metrics.darkSpots.score} />
          <MetricRow label="ความเรียบเนียน (ริ้วรอย)" score={metrics.wrinkles.score} />
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <Button size="none" className="px-4 py-2.5 text-xs shadow-cardHover" onClick={askAdvisor}>
            <Sparkles size={13} /> คุยกับน้อง Smoothie เรื่องผลสแกนนี้
          </Button>
          {photo && <ShareCard metrics={metrics} photoDataUrl={photo} zones={zones} />}
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-surface-soft mt-5 p-3.5 text-xs text-slate-500">
          <Info size={15} className="shrink-0 mt-0.5 text-slate-400" />
          <p>{metrics.disclaimer}</p>
        </div>
      </div>

      <div className="mb-8">
        <RewardClaim score={total} />
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-8">
        {concerns.map((slug) => {
          const info = concernLabel(slug);
          const items = productsForConcern(slug, 3);
          if (!info || items.length === 0) return null;
          return (
            <div key={slug} className="mb-8">
              <h3 className="text-lg font-bold text-brand-ink mb-1">แนะนำสำหรับ {info.nameTh}</h3>
              <p className="text-xs text-slate-500 mb-4">{info.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-4">
                {items.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onRestart}
        className="mx-auto flex items-center gap-2 text-xs text-slate-400 hover:text-brand-emerald mt-2"
      >
        <RotateCcw size={14} />
        สแกนใหม่อีกครั้ง
      </button>
    </div>
  );
}
