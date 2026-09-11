"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import ConsentGate, { hasStoredConsent } from "@/components/skin-coach/ConsentGate";
import Stepper from "@/components/skin-coach/Stepper";
import FrontStep from "@/components/skin-coach/FrontStep";
import LiveScanStep, { liveScanSupported } from "@/components/skin-coach/LiveScanStep";
import AnglesStep from "@/components/skin-coach/AnglesStep";
import QuestionsStep from "@/components/skin-coach/QuestionsStep";
import AnalyzingStep from "@/components/skin-coach/AnalyzingStep";
import ResultsView from "@/components/skin-coach/ResultsView";
import type { ResizedImage } from "@/lib/image-utils";
import { ANGLES, type AngleKey, type ScanAnswers, type SkinCoachMetrics } from "@/lib/skin-coach";

type Step = "front" | "angles" | "questions" | "analyzing" | "result";
type Shots = Partial<Record<AngleKey, ResizedImage>>;

// Stepper position for each screen; analysing counts as the last question
// being answered, not a step of its own.
const STEP_INDEX: Record<Step, number> = { front: 0, angles: 1, questions: 2, analyzing: 2, result: 3 };

export default function SkinCoachPage() {
  const [consented, setConsented] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>("front");
  const [shots, setShots] = useState<Shots>({});
  const [answers, setAnswers] = useState<ScanAnswers>({});
  const [metrics, setMetrics] = useState<SkinCoachMetrics | null>(null);
  const [frontError, setFrontError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  // Live camera scan where the browser can do it; the photo picker otherwise,
  // or whenever the person chooses it.
  const [captureMode, setCaptureMode] = useState<"live" | "photo">("photo");

  useEffect(() => {
    setConsented(hasStoredConsent());
    if (liveScanSupported()) setCaptureMode("live");
    setHydrated(true);
  }, []);

  // Each step starts at the top — on a phone the next screen would otherwise
  // open wherever the last button left the scroll.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  if (!hydrated) return null;
  if (!consented) return <ConsentGate onConsent={() => setConsented(true)} />;

  // Front first, then the extras in the order they're offered.
  const angles = ANGLES.map((a) => a.key).filter((k) => shots[k]);

  async function analyze() {
    setStep("analyzing");
    setAnalyzeError(null);
    try {
      const images = angles.map((key) => ({
        base64: shots[key]!.base64,
        mediaType: shots[key]!.mediaType,
        zone: ANGLES.find((a) => a.key === key)!.label,
      }));
      const res = await fetch("/api/skin-coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images }),
      });
      // Not every failure is ours to phrase: an oversized body is refused by
      // the platform with a non-JSON 413 before the route runs.
      const data = await res.json().catch(() => null);
      if (!data) {
        setAnalyzeError(res.status === 413 ? "รูปใหญ่เกินไป ลองถ่ายใหม่หรือใช้จำนวนมุมน้อยลง" : "วิเคราะห์ไม่สำเร็จ กดดูผลอีกครั้งได้เลย");
        setStep("questions");
        return;
      }
      const result = data?.result as SkinCoachMetrics | undefined;

      if (data?.error || !result?.skinAge || !result.acne || !result.pores || !result.darkSpots || !result.wrinkles) {
        // Most failures carry a Thai `message`; the hourly limit (429) puts
        // its Thai text in `error` instead, and that one tells a guest to
        // sign in to keep going — worth showing rather than a generic line.
        const limitText = res.status === 429 && typeof data?.error === "string" ? data.error : null;
        setAnalyzeError(data?.message || limitText || "วิเคราะห์ไม่สำเร็จ กดดูผลอีกครั้งได้เลย");
        setStep("questions");
        return;
      }
      if (!result.faceDetected) {
        // The photo is the problem, so go back to where it's taken.
        setFrontError("มองไม่เห็นใบหน้าชัดพอ ลองถ่ายใหม่ในที่สว่าง หันหน้าตรงเข้ากล้อง");
        // A live scan's three photos were taken together, so all of them go;
        // a picked photo set keeps its extra angles and replaces the front.
        setShots((prev) => {
          if (captureMode === "live") return {};
          const { front, ...rest } = prev;
          void front;
          return rest;
        });
        setStep("front");
        return;
      }
      setMetrics(result);
      setStep("result");
    } catch {
      setAnalyzeError("การเชื่อมต่อขัดข้อง กดดูผลอีกครั้งได้เลย");
      setStep("questions");
    }
  }

  function restart() {
    setShots({});
    setAnswers({});
    setMetrics(null);
    setFrontError(null);
    setAnalyzeError(null);
    if (liveScanSupported()) setCaptureMode("live");
    setStep("front");
  }

  return (
    <div className="container-page max-w-2xl py-8 md:py-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0">
          <Image src="/mascot/smoothie-hi.png" alt="" fill sizes="56px" className="object-contain" priority />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight text-brand-ink md:text-3xl">สแกนผิวกับน้อง Smoothie</h1>
          <p className="mt-0.5 text-sm text-slate-600">ประเมินผิวจากรูปถ่าย เพื่อความสวยงาม ไม่ใช่การวินิจฉัยทางการแพทย์</p>
        </div>
      </header>

      <Stepper current={STEP_INDEX[step]} />

      {step === "front" && captureMode === "live" && (
        <LiveScanStep
          notice={frontError}
          onComplete={(captured) => {
            setShots(captured);
            setFrontError(null);
            // All three angles came from the live scan: straight to the
            // questions. Fewer, and the add-an-angle step offers the rest.
            setStep(Object.keys(captured).length >= 3 ? "questions" : captured.front ? "angles" : "front");
          }}
          onUsePhoto={() => setCaptureMode("photo")}
        />
      )}
      {step === "front" && captureMode === "photo" && (
        <FrontStep
          photo={shots.front}
          error={frontError}
          onPhoto={(image) => {
            setShots((prev) => ({ ...prev, front: image }));
            setFrontError(null);
          }}
          onError={setFrontError}
          onNext={() => setStep("angles")}
          onUseLive={liveScanSupported() ? () => setCaptureMode("live") : undefined}
        />
      )}
      {step === "angles" && (
        <AnglesStep
          shots={shots}
          onShot={(angle, image) => setShots((prev) => ({ ...prev, [angle]: image }))}
          onRemove={(angle) =>
            setShots((prev) => {
              const next = { ...prev };
              delete next[angle];
              return next;
            })
          }
          onNext={() => setStep("questions")}
        />
      )}
      {step === "questions" && (
        <QuestionsStep
          answers={answers}
          error={analyzeError}
          // Merged, not replaced, so two quick taps can't overwrite each other.
          onChange={(patch) => setAnswers((prev) => ({ ...prev, ...patch }))}
          onSubmit={analyze}
        />
      )}
      {step === "analyzing" && <AnalyzingStep photos={angles.map((k) => shots[k]!.dataUrl)} />}
      {step === "result" && metrics && (
        <ResultsView
          metrics={metrics}
          photo={shots.front?.dataUrl ?? null}
          angles={angles}
          answers={answers}
          onRestart={restart}
        />
      )}

      {step !== "front" && step !== "analyzing" && step !== "result" && (
        <button
          type="button"
          onClick={() => setStep(step === "questions" ? "angles" : "front")}
          className="mt-4 flex items-center gap-1 text-sm text-slate-600 hover:text-brand-ink"
        >
          <ChevronLeft size={16} aria-hidden="true" /> ย้อนกลับ
        </button>
      )}
    </div>
  );
}
