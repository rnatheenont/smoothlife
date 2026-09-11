"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Check, Plus, X } from "lucide-react";
import type { ResizedImage } from "@/lib/image-utils";
import { ANGLES, SCAN_BONUS_MIN_ANGLES, SCAN_BONUS_POINTS, confidenceFor, type AngleKey } from "@/lib/skin-coach";
import { Button } from "@/components/ui";
import { usePhotoPicker } from "./PhotoPicker";

type Shots = Partial<Record<AngleKey, ResizedImage>>;

// Three steps of "how much the scan has to go on", filled as angles are
// added. A level, not a percentage: more photos help, but nobody can say by
// exactly how much.
function AccuracyMeter({ count }: { count: number }) {
  const { label, step } = confidenceFor(count);
  return (
    <div className="rounded-xl2 bg-surface-mist p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-slate-600">ความละเอียดของผลสแกน</p>
        <p className="text-sm font-bold text-brand-ink">{label}</p>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={clsx("h-1.5 rounded-full", n <= step ? "bg-brand-action" : "bg-white")} />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {step === 1 && "เพิ่มอีก 1 มุม ผลจะละเอียดขึ้นเป็นระดับ “ดี”"}
        {step === 2 && "เพิ่มอีก 1 มุม ผลจะละเอียดที่สุด"}
        {step === 3 && "ครบแล้ว ผลสแกนละเอียดที่สุด"}
      </p>
    </div>
  );
}

export default function AnglesStep({
  shots,
  onShot,
  onRemove,
  onNext,
}: {
  shots: Shots;
  onShot: (angle: AngleKey, image: ResizedImage) => void;
  onRemove: (angle: AngleKey) => void;
  onNext: () => void;
}) {
  // A ref, not state: the file can arrive before React re-renders with the
  // angle that was just tapped, and a stale closure would drop the photo.
  const active = useRef<AngleKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const picker = usePhotoPicker(
    (image) => {
      if (active.current) onShot(active.current, image);
      setError(null);
    },
    setError
  );
  const extras = ANGLES.filter((a) => a.key !== "front");
  const count = Object.keys(shots).length;

  function take(angle: AngleKey) {
    active.current = angle;
    picker.openCamera();
  }

  return (
    <section>
      <h2 className="text-lg font-bold text-brand-ink md:text-xl">อยากให้ผลละเอียดขึ้นไหม</h2>
      <p className="mt-1 text-sm text-slate-600">ไม่บังคับ ถ่ายใกล้ๆ เฉพาะมุมที่อยากให้ดูเป็นพิเศษ หรือข้ามไปก่อนก็ได้</p>

      <div className="mt-5">
        <AccuracyMeter count={count} />
      </div>
      <p className="mt-2 text-xs text-slate-600">
        สมาชิกที่ถ่ายครบ {SCAN_BONUS_MIN_ANGLES} มุมและกดบันทึกผล รับ +{SCAN_BONUS_POINTS} คะแนน (เดือนละครั้ง)
      </p>

      <ul className="mt-4 divide-y divide-surface-line rounded-xl2 border border-surface-line">
        {extras.map((angle) => {
          const shot = shots[angle.key];
          return (
            <li key={angle.key} className="flex items-center gap-3 px-4 py-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-mist">
                {shot && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot.dataUrl} alt="" width={48} height={48} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-ink">{angle.label}</p>
                <p className="text-xs text-slate-600">{angle.helps}</p>
              </div>
              {shot ? (
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-1 text-xs font-semibold text-brand-800">
                    <Check size={14} aria-hidden="true" /> ถ่ายแล้ว
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(angle.key)}
                    aria-label={`ลบรูป${angle.label}`}
                    className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => take(angle.key)}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-surface-line px-3.5 py-2 text-xs font-semibold text-brand-800 transition-colors hover:bg-surface-mist"
                >
                  <Plus size={14} aria-hidden="true" /> ถ่าย<span className="sr-only">{angle.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        <Button size="lg" onClick={onNext}>
          {count > 1 ? `ต่อไป (${count} มุม)` : "ต่อไป"}
        </Button>
        {count === 1 && (
          <button type="button" onClick={onNext} className="py-1 text-center text-sm text-slate-600 hover:text-brand-ink">
            ข้าม ใช้แค่รูปหน้าตรง
          </button>
        )}
      </div>
      {picker.inputs}
    </section>
  );
}
