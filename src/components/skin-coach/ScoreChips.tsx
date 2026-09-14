"use client";

import clsx from "clsx";
import { CONCERN_DEFS, CONCERN_KEYS, concernScore, type ConcernMetric, type ConcernResults } from "@/lib/skin-analysis";

function Ring({ score, color, selected }: { score: number; color: string; selected: boolean }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid h-14 w-14 place-items-center">
      <svg viewBox="0 0 52 52" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="26" cy="26" r={r} fill={selected ? color : "#fff"} fillOpacity={selected ? 0.14 : 1} stroke="#E2E8F0" strokeWidth="4" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
        />
      </svg>
      <span className="relative text-base font-bold tabular-nums text-brand-ink">{score}</span>
    </span>
  );
}

/**
 * The row of score rings under the face map: overall first, then each
 * concern. Picking one switches what the map shades.
 */
export default function ScoreChips({
  concerns,
  health,
  selected,
  onSelect,
}: {
  concerns: ConcernResults;
  health: number;
  selected: ConcernMetric | "all";
  onSelect: (key: ConcernMetric | "all") => void;
}) {
  const chips: { key: ConcernMetric | "all"; label: string; score: number; color: string }[] = [
    { key: "all", label: "ภาพรวม", score: health, color: "#00A87B" },
    ...CONCERN_KEYS.map((k) => ({ key: k, label: CONCERN_DEFS[k].label, score: concernScore(concerns[k].severity), color: CONCERN_DEFS[k].color })),
  ];
  return (
    <div role="tablist" aria-label="เลือกดูผลแต่ละด้าน" className="scrollbar-none -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
      {chips.map((chip) => {
        const isOn = chip.key === selected;
        return (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={isOn}
            aria-label={`${chip.label} ${chip.score} คะแนน`}
            onClick={(e) => {
              onSelect(chip.key);
              e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }}
            className={clsx(
              "flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-1 rounded-xl py-1.5 transition-colors",
              isOn ? "bg-surface-mist" : "hover:bg-slate-50"
            )}
          >
            <Ring score={chip.score} color={chip.color} selected={isOn} />
            <span className={clsx("line-clamp-2 text-center text-[11px] leading-tight", isOn ? "font-semibold text-brand-ink" : "text-slate-600")}>
              {chip.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
