"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-2xl font-bold text-brand-ink mb-3">เกิดข้อผิดพลาดบางอย่าง</h1>
      <p className="text-slate-500 mb-6">ขออภัยในความไม่สะดวก กรุณาลองใหม่อีกครั้ง</p>
      <button
        onClick={reset}
        className="rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm"
      >
        ลองใหม่อีกครั้ง
      </button>
    </div>
  );
}
