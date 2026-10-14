"use client";

import { Suspense } from "react";
import SearchContent from "@/components/SearchContent";

/**
 * The search page as it was written, kept as its own client module.
 *
 * It lives here rather than in page.tsx because page.tsx has to be a server
 * component to be able to choose between this and the document — and a file
 * marked "use client" cannot render a server component at all. The markup is
 * unchanged, so the flag-off path is the page it always was.
 */
export default function SearchWritten() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-slate-500">กำลังโหลด…</div>}>
      <SearchContent />
    </Suspense>
  );
}
