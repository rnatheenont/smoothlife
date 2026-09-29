import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "ออฟไลน์ | Smoothlife.com" };

// Where the app lands with no signal. Kept static and tiny: it is cached at
// install time, so everything on it has to work without the network it is
// apologising for.
export default function OfflinePage() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-surface-soft text-brand-800">
        <WifiOff size={28} aria-hidden />
      </span>
      <h1 className="mt-5 text-xl font-bold text-brand-ink">ตอนนี้ไม่ได้เชื่อมต่ออินเทอร์เน็ต</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
        หน้านี้ต้องใช้เน็ตในการโหลดข้อมูลล่าสุด — ราคาและสต็อกเปลี่ยนได้ตลอด เราเลยไม่เก็บของเก่าไว้ให้ดู
        ลองเชื่อมต่อใหม่แล้วกดโหลดอีกครั้งได้เลยค่ะ
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand-action px-7 text-sm font-semibold text-white"
      >
        ลองใหม่อีกครั้ง
      </Link>
    </div>
  );
}
