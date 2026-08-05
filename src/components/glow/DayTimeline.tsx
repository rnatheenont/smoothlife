"use client";

import { Check } from "lucide-react";

export default function DayTimeline({
  entries,
  currentDay,
}: {
  entries: Record<number, unknown>;
  currentDay: number;
}) {
  return (
    <div className="flex items-center justify-between gap-1.5 mb-8">
      {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
        const done = Boolean(entries[day]);
        const isToday = day === currentDay;
        return (
          <div key={day} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={
                "h-8 w-8 md:h-9 md:w-9 rounded-full grid place-items-center text-xs font-bold border-2 " +
                (done
                  ? "bg-brand-gradient text-white border-transparent"
                  : isToday
                  ? "border-brand-emerald text-brand-emerald bg-white"
                  : "border-slate-200 text-slate-300 bg-white")
              }
            >
              {done ? <Check size={16} /> : day}
            </div>
            <span className="text-[10px] text-slate-400">วัน {day}</span>
          </div>
        );
      })}
    </div>
  );
}
