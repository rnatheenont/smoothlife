"use client";

import { Suspense } from "react";
import LoginContent from "@/components/LoginContent";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-slate-500">กำลังโหลด…</div>}>
      <LoginContent />
    </Suspense>
  );
}
