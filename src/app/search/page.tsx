"use client";

import { Suspense } from "react";
import SearchContent from "@/components/SearchContent";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-slate-500">กำลังโหลด…</div>}>
      <SearchContent />
    </Suspense>
  );
}
