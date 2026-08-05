"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, AlertTriangle } from "lucide-react";
import { resizeForUpload } from "@/lib/image-utils";
import { SkinCoachMetrics } from "@/lib/skin-coach";

export default function CaptureCard({ onResult }: { onResult: (metrics: SkinCoachMetrics) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const upload = await resizeForUpload(file);
      setPreview(upload.dataUrl);

      const res = await fetch("/api/skin-coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ base64: upload.base64, mediaType: upload.mediaType }),
      });
      const data = await res.json();

      if (data?.error) {
        setError(data.message || "ขออภัยครับ วิเคราะห์รูปไม่สำเร็จ กรุณาลองใหม่");
        setBusy(false);
        return;
      }

      const result = data?.result as SkinCoachMetrics;
      if (!result || !result.acne || !result.pores || !result.darkSpots || !result.wrinkles) {
        setError("ขออภัยครับ ผลวิเคราะห์ไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง");
        setBusy(false);
        return;
      }
      if (!result.faceDetected) {
        setError("ไม่พบใบหน้าในภาพชัดเจน กรุณาถ่ายใหม่ในที่ที่แสงสว่างเพียงพอ");
        setBusy(false);
        return;
      }

      onResult(result);
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างประมวลผลภาพ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl2 border border-slate-100 shadow-card p-6 md:p-8 text-center">
      <h2 className="text-lg font-bold text-brand-ink mb-1">ถ่ายเซลฟีเพื่อสแกนผิว</h2>
      <p className="text-sm text-slate-500 mb-6">
        หันหน้าตรงกล้อง อยู่ในที่แสงสว่างสม่ำเสมอ ไม่สวมแว่นหรือหน้ากาก
      </p>

      <div className="relative mx-auto mb-6 h-56 w-56 rounded-full border-2 border-dashed border-slate-200 grid place-items-center overflow-hidden bg-surface-soft">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="ตัวอย่างรูปที่ถ่าย" className="h-full w-full object-cover" />
        ) : (
          <Camera size={40} className="text-slate-300" />
        )}
        {busy && (
          <div className="absolute inset-0 bg-white/70 grid place-items-center">
            <Loader2 size={28} className="animate-spin text-brand-emerald" />
          </div>
        )}
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
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm disabled:opacity-50"
      >
        {busy ? "กำลังวิเคราะห์..." : "ถ่ายรูปเพื่อสแกนผิว"}
      </button>
    </div>
  );
}
