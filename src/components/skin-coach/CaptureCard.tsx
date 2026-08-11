"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, AlertTriangle, Check, Sparkles } from "lucide-react";
import { resizeForUpload, ResizedImage } from "@/lib/image-utils";
import { SkinCoachMetrics } from "@/lib/skin-coach";

// Schematic viewfinder + face guide (not a real photo) showing how to frame
// the shot — corner brackets like a camera focus guide, soft face outline
// centered inside.
function ExampleFrame() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24 sm:h-28 sm:w-28 shrink-0">
      <rect x="2" y="2" width="92" height="92" rx="16" fill="url(#exampleBg)" />
      <ellipse cx="48" cy="52" rx="20" ry="24" fill="#ffffff" fillOpacity="0.85" />
      <ellipse cx="40" cy="48" rx="2.4" ry="3" fill="#0F172A" fillOpacity="0.55" />
      <ellipse cx="56" cy="48" rx="2.4" ry="3" fill="#0F172A" fillOpacity="0.55" />
      <path d="M40 62c3 3 13 3 16 0" stroke="#0F172A" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* corner brackets */}
      {[
        "M10 22V12a2 2 0 0 1 2-2h10",
        "M74 10h10a2 2 0 0 1 2 2v10",
        "M86 74v10a2 2 0 0 1-2 2H74",
        "M22 86H12a2 2 0 0 1-2-2V74",
      ].map((d, i) => (
        <path key={i} d={d} stroke="#00A87B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      ))}
      <defs>
        <linearGradient id="exampleBg" x1="0" y1="0" x2="96" y2="96">
          <stop offset="0%" stopColor="#E6FBF5" />
          <stop offset="100%" stopColor="#E6F6FE" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const ZONES = [
  { key: "front", label: "หน้าตรง" },
  { key: "forehead", label: "หน้าผาก" },
  { key: "cheek", label: "แก้ม" },
  { key: "eye", label: "ขอบตา" },
  { key: "chin", label: "คาง" },
  { key: "problem", label: "จุดที่มีปัญหา" },
] as const;

type ZoneKey = (typeof ZONES)[number]["key"];

export default function CaptureCard({
  onResult,
}: {
  onResult: (metrics: SkinCoachMetrics, heroPhotoDataUrl: string, zoneLabels: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [shots, setShots] = useState<Partial<Record<ZoneKey, ResizedImage>>>({});
  const [order, setOrder] = useState<ZoneKey[]>([]);
  const [activeZone, setActiveZone] = useState<ZoneKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capturedCount = order.length;

  function openCamera(zone: ZoneKey) {
    setActiveZone(zone);
    inputRef.current?.click();
  }

  async function handleFile(file: File) {
    if (!activeZone) return;
    setError(null);
    try {
      const upload = await resizeForUpload(file);
      setShots((prev) => ({ ...prev, [activeZone]: upload }));
      setOrder((prev) => (prev.includes(activeZone) ? prev : [...prev, activeZone]));
    } catch {
      setError("ไม่สามารถอ่านรูปนี้ได้ กรุณาลองใหม่อีกครั้ง");
    }
  }

  async function submit() {
    if (capturedCount === 0) return;
    setBusy(true);
    setError(null);
    try {
      const images = order.map((zone) => {
        const s = shots[zone]!;
        return { base64: s.base64, mediaType: s.mediaType, zone: ZONES.find((z) => z.key === zone)!.label };
      });
      const res = await fetch("/api/skin-coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();

      if (data?.error) {
        setError(data.message || "ขออภัยครับ วิเคราะห์รูปไม่สำเร็จ กรุณาลองใหม่");
        return;
      }

      const result = data?.result as SkinCoachMetrics;
      if (!result || !result.acne || !result.pores || !result.darkSpots || !result.wrinkles || !result.skinAge) {
        setError("ขออภัยครับ ผลวิเคราะห์ไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      if (!result.faceDetected) {
        setError("ไม่พบใบหน้าในภาพชัดเจน กรุณาถ่ายใหม่ในที่ที่แสงสว่างเพียงพอ");
        return;
      }

      const hero = shots.front?.dataUrl || shots[order[0]]!.dataUrl;
      const zoneLabels = order.map((zone) => ZONES.find((z) => z.key === zone)!.label);
      onResult(result, hero, zoneLabels);
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างประมวลผลภาพ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto rounded-xl2 border border-slate-100 shadow-card p-6 sm:p-8 lg:p-10 text-center">
      <h2 className="text-lg sm:text-xl font-bold text-brand-ink mb-1">เลือกมุมที่จะถ่าย</h2>
      <p className="text-sm text-slate-500 mb-6">
        ถ่ายได้ตั้งแต่ 1 มุมขึ้นไป ยิ่งถ่ายหลายมุม น้อง Smoothie ยิ่งวิเคราะห์ผิวคุณได้แม่นยำขึ้น
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl2 bg-surface-soft p-4 sm:p-5 mb-6 text-left">
        <ExampleFrame />
        <div>
          <p className="text-xs font-semibold text-brand-ink mb-1.5">ตัวอย่างการถ่ายรูปที่ดี</p>
          <ul className="text-xs text-slate-500 space-y-1">
            <li>• อยู่ในที่แสงสว่าง เห็นผิวหน้าชัดเจน</li>
            <li>• มองตรงกล้อง ไม่เอียงหน้า</li>
            <li>• ไม่ใส่แว่น หมวก หรือแต่งหน้าหนา</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-6">
        {ZONES.map((z) => {
          const shot = shots[z.key];
          return (
            <button key={z.key} onClick={() => openCamera(z.key)} className="flex flex-col items-center gap-2">
              <div
                className={`relative h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 grid place-items-center overflow-hidden bg-surface-soft transition-colors ${
                  shot ? "border-brand-emerald" : "border-dashed border-slate-200 hover:border-brand-teal"
                }`}
              >
                {shot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot.dataUrl} alt={z.label} className="h-full w-full object-cover" />
                ) : (
                  <Camera size={20} className="text-slate-300" />
                )}
                {shot && (
                  <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-brand-emerald text-white grid place-items-center">
                    <Check size={12} />
                  </div>
                )}
              </div>
              <span className={`text-[11px] sm:text-xs font-medium ${shot ? "text-brand-emerald" : "text-slate-500"}`}>{z.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-left text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-4">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      <button
        disabled={busy || capturedCount === 0}
        onClick={submit}
        className="flex items-center gap-2 mx-auto rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm disabled:opacity-40"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {busy ? "กำลังวิเคราะห์..." : capturedCount === 0 ? "เลือกถ่ายรูปอย่างน้อย 1 มุม" : `วิเคราะห์ผิวเลย (${capturedCount} มุม)`}
      </button>
    </div>
  );
}
