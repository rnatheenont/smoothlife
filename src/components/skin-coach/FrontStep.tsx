"use client";

import { Camera, ImageIcon, RotateCcw } from "lucide-react";
import type { ResizedImage } from "@/lib/image-utils";
import { Button } from "@/components/ui";
import { usePhotoPicker } from "./PhotoPicker";

// Where the face should sit. A plain oval on the mist ground — how a
// consultant would frame a photo, not a scanner reticle.
function FaceGuide({ photo }: { photo?: string }) {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[11rem] overflow-hidden sm:max-w-[16rem] rounded-xl2 bg-surface-mist">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="รูปหน้าตรงที่ถ่ายไว้" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <svg viewBox="0 0 160 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <ellipse
          cx="80"
          cy="96"
          rx="50"
          ry="66"
          fill="none"
          stroke={photo ? "#ffffff" : "#05755f"}
          strokeOpacity={photo ? 0.9 : 0.55}
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
      </svg>
      {!photo && (
        <p className="absolute inset-x-0 bottom-3 text-center text-xs text-slate-600">ให้ใบหน้าอยู่ในกรอบวงรี</p>
      )}
    </div>
  );
}

export default function FrontStep({
  photo,
  error,
  onPhoto,
  onError,
  onNext,
  onUseLive,
}: {
  photo?: ResizedImage;
  error: string | null;
  onPhoto: (image: ResizedImage) => void;
  onError: (message: string) => void;
  onNext: () => void;
  onUseLive?: () => void;
}) {
  const picker = usePhotoPicker(onPhoto, onError);

  return (
    <section>
      <h2 className="text-lg font-bold text-brand-ink md:text-xl">ถ่ายรูปหน้าตรง 1 รูป</h2>
      <p className="mt-1 text-sm text-slate-600">รูปเดียวก็สแกนได้ ถ้าอยากให้ละเอียดขึ้น เพิ่มมุมอื่นได้ในขั้นถัดไป</p>

      <div className="mt-5 grid gap-5 sm:grid-cols-[16rem,1fr] sm:items-start">
        <FaceGuide photo={photo?.dataUrl} />
        <div>
          <p className="text-sm font-semibold text-brand-ink">ถ่ายให้ได้ผลดีที่สุด</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 marker:text-brand-800/50">
            <li>หันหน้าเข้าหาหน้าต่างหรือแสงสว่าง ไม่ย้อนแสง</li>
            <li>มองตรงกล้อง ไม่เอียงหน้า</li>
            <li>ถอดแว่น เปิดหน้าผาก และเลี่ยงการแต่งหน้าหนา</li>
          </ul>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2.5">
            {photo ? (
              <>
                <Button size="lg" onClick={onNext}>
                  ใช้รูปนี้
                </Button>
                <Button size="lg" variant="secondary" onClick={picker.openCamera}>
                  <RotateCcw size={16} aria-hidden="true" /> ถ่ายใหม่
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" onClick={picker.openCamera}>
                  <Camera size={17} aria-hidden="true" /> ถ่ายรูปหน้าตรง
                </Button>
                <Button size="lg" variant="secondary" onClick={picker.openLibrary}>
                  <ImageIcon size={17} aria-hidden="true" /> เลือกรูปจากเครื่อง
                </Button>
              </>
            )}
          </div>
          {onUseLive && !photo && (
            <button type="button" onClick={onUseLive} className="mt-3 text-sm font-semibold text-brand-800 hover:underline">
              สแกนสดด้วยกล้องแทน (ถ่ายให้เอง 3 มุม)
            </button>
          )}
        </div>
      </div>
      {picker.inputs}
    </section>
  );
}
