"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import ConsentGate, { hasStoredConsent } from "@/components/skin-coach/ConsentGate";
import CaptureCard from "@/components/skin-coach/CaptureCard";
import ResultsView from "@/components/skin-coach/ResultsView";
import { SkinCoachMetrics } from "@/lib/skin-coach";

export default function SkinCoachPage() {
  const [consented, setConsented] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [metrics, setMetrics] = useState<SkinCoachMetrics | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [zones, setZones] = useState<string[]>([]);

  useEffect(() => {
    setConsented(hasStoredConsent());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;
  if (!consented) return <ConsentGate onConsent={() => setConsented(true)} />;

  return (
    <div className="container-page py-8 md:py-10 max-w-2xl lg:max-w-4xl">
      <div className="flex items-center gap-2 text-brand-emerald mb-2">
        <Sparkles size={18} />
        <span className="text-xs font-semibold uppercase tracking-wide">Skin Coach</span>
      </div>
      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-brand-ink mb-2 leading-tight">
        สแกนตรวจสุขภาพผิวและอายุเซลล์ผิวด้วย AI
      </h1>
      <p className="text-sm text-slate-500 mb-6 max-w-xl">
        วิเคราะห์ผิวเบื้องต้นด้วย AI จากภาพถ่ายของคุณ เพื่อความสวยงามเท่านั้น
        ไม่ใช่การวินิจฉัยทางการแพทย์ หากมีความกังวลด้านผิวหนัง ควรปรึกษาแพทย์ผิวหนัง
      </p>

      {!metrics && (
        <CaptureCard
          onResult={(m, heroPhoto, zoneLabels) => {
            setMetrics(m);
            setPhoto(heroPhoto);
            setZones(zoneLabels);
          }}
        />
      )}
      {metrics && (
        <ResultsView
          metrics={metrics}
          photo={photo}
          zones={zones}
          onRestart={() => {
            setMetrics(null);
            setPhoto(null);
            setZones([]);
          }}
        />
      )}
    </div>
  );
}
