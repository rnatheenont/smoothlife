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

  useEffect(() => {
    setConsented(hasStoredConsent());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;
  if (!consented) return <ConsentGate onConsent={() => setConsented(true)} />;

  return (
    <div className="container-page py-8 md:py-10 max-w-2xl">
      <div className="flex items-center gap-2 text-brand-emerald mb-1">
        <Sparkles size={18} />
        <span className="text-xs font-semibold uppercase tracking-wide">Skin Coach</span>
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-6">
        เพียงเซลฟีเดียว รู้ผิวคุณ พร้อมสินค้าที่ใช่
      </h1>

      {!metrics && <CaptureCard onResult={setMetrics} />}
      {metrics && <ResultsView metrics={metrics} onRestart={() => setMetrics(null)} />}
    </div>
  );
}
