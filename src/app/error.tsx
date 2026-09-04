"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

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
      <Button size="lg" onClick={reset}>
        ลองใหม่อีกครั้ง
      </Button>
    </div>
  );
}
