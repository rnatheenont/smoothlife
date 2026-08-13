"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function BackButton({ fallbackHref, label = "กลับ" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();

  function handleBack() {
    // A deep-linked visit (no in-app history to go back to, e.g. opened
    // straight from a shared link) should still land somewhere sensible
    // instead of router.back() leaving the site entirely.
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  return (
    <button
      onClick={handleBack}
      className="lg:hidden flex items-center gap-0.5 text-sm font-medium text-slate-600 -ml-1.5 mb-3 active:scale-95 transition-transform"
      aria-label={label}
    >
      <ChevronLeft size={18} /> {label}
    </button>
  );
}
