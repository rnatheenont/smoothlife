"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { useQuickChat } from "@/lib/quickchat-context";
import {
  SkinCoachMetrics,
  topConcerns,
  concernLabel,
  productsForConcern,
} from "@/lib/skin-coach";

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

// Combined headline score = average clarity across the four scanned areas.
// Kept as a simple, explainable mean (not a hidden model output) so the
// number on screen always matches the bars underneath it.
function overallScore(metrics: SkinCoachMetrics) {
  const clarities = [metrics.acne.score, metrics.pores.score, metrics.darkSpots.score, metrics.wrinkles.score].map(
    (s) => Math.max(0, Math.min(100, 100 - s))
  );
  return Math.round(clarities.reduce((a, b) => a + b, 0) / clarities.length);
}

function scoreBand(score: number) {
  if (score >= 85) return { label: "ผิวสุขภาพดีมาก", ring: "text-brand-emerald", chip: "bg-brand-gradient-soft text-brand-emerald" };
  if (score >= 70) return { label: "ผิวสุขภาพดี", ring: "text-brand-teal", chip: "bg-brand-gradient-soft text-brand-emerald" };
  if (score >= 50) return { label: "ผิวปานกลาง ดูแลเพิ่มได้", ring: "text-amber-500", chip: "bg-amber-50 text-amber-600" };
  return { label: "ควรดูแลผิวเพิ่มเติม", ring: "text-rose-500", chip: "bg-rose-50 text-rose-600" };
}

export default function ResultsView({ metrics, onRestart }: { metrics: SkinCoachMetrics; onRestart: () => void }) {
  const concerns = topConcerns(metrics, 2);
  const { openWithProfile } = useQuickChat();
  const total = overallScore(metrics);
  const band = scoreBand(total);
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
    <div>
      <div className="rounded-xl2 border border-slate-100 shadow-card p-6 mb-6">
        <h2 className="font-bold text-brand-ink mb-5">ผลสแกนผิวของคุณ</h2>

        <div className="flex flex-col sm:flex-row items-center gap-6 mb-6 pb-6 border-b border-slate-100">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
                className={band.ring}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-brand-ink leading-none">{total}</span>
              <span className="text-[10px] text-slate-400">/100</span>
            </div>
          </div>
          <div className="text-center sm:text-left">
            <span className={`inline-block text-xs font-semibold rounded-full px-3 py-1 mb-2 ${band.chip}`}>
              {band.label}
            </span>
            <p className="text-sm text-slate-600">{metrics.overallNote}</p>
          </div>
        </div>

        <MetricRow label="ความเรียบเนียน (สิว)" score={metrics.acne.score} />
        <MetricRow label="ความละเอียดของรูขุมขน" score={metrics.pores.score} />
        <MetricRow label="ความสม่ำเสมอของสีผิว (จุดด่างดำ)" score={metrics.darkSpots.score} />
        <MetricRow label="ความเรียบเนียน (ริ้วรอย)" score={metrics.wrinkles.score} />

        <button
          onClick={askAdvisor}
          className="mt-4 flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-full bg-brand-gradient text-white text-xs font-semibold px-4 py-2.5 shadow-cardHover"
        >
          <Sparkles size={13} /> คุยกับ AI Advisor เรื่องผลสแกนนี้
        </button>

        <p className="text-[11px] text-slate-400 mt-4 border-t border-slate-100 pt-3">{metrics.disclaimer}</p>
      </div>

      {concerns.map((slug) => {
        const info = concernLabel(slug);
        const items = productsForConcern(slug, 3);
        if (!info || items.length === 0) return null;
        return (
          <div key={slug} className="mb-8">
            <h3 className="text-lg font-bold text-brand-ink mb-1">แนะนำสำหรับ {info.nameTh}</h3>
            <p className="text-xs text-slate-500 mb-4">{info.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {items.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </div>
        );
      })}

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
