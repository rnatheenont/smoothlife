"use client";

import { GlowChallengeProvider, useGlowChallenge } from "@/lib/glow-challenge-context";
import ConsentGate from "@/components/glow/ConsentGate";
import DayTimeline from "@/components/glow/DayTimeline";
import CaptureStep from "@/components/glow/CaptureStep";
import ScoreSummary from "@/components/glow/ScoreSummary";
import { Sparkles } from "lucide-react";

function GlowChallengeApp() {
  const { consented, entries, currentDay, resetAll } = useGlowChallenge();

  if (!consented) return <ConsentGate />;

  const complete = currentDay > 7;

  return (
    <div className="container-page py-8 md:py-10 max-w-xl">
      <div className="flex items-center gap-2 text-brand-emerald mb-1">
        <Sparkles size={18} />
        <span className="text-xs font-semibold uppercase tracking-wide">Glow Challenge</span>
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-6">ท้าทาย 7 วัน เพื่อผิวใสขึ้น</h1>

      <DayTimeline entries={entries} currentDay={currentDay} />

      {!complete && <CaptureStep day={currentDay} />}

      {complete && (
        <div className="text-center mb-6 rounded-xl2 bg-brand-gradient-soft p-5">
          <p className="font-semibold text-brand-ink">ครบ 7 วันแล้ว! เก่งมากครับ 🎉</p>
          <button
            onClick={() => {
              if (confirm("เริ่ม Challenge รอบใหม่ใช่หรือไม่? ข้อมูล 7 วันก่อนหน้าจะถูกลบ")) resetAll();
            }}
            className="text-xs text-brand-emerald underline mt-2"
          >
            เริ่มรอบใหม่
          </button>
        </div>
      )}

      {Object.keys(entries).length > 0 && (
        <div className="mt-8">
          <ScoreSummary />
        </div>
      )}
    </div>
  );
}

export default function GlowChallengePage() {
  return (
    <GlowChallengeProvider>
      <GlowChallengeApp />
    </GlowChallengeProvider>
  );
}
