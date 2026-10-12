"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

// "เก็บโค้ด" — copies a discount code and says so.
//
// Copying, not applying. The storefront cart has no path that attaches a
// discount code to the cart yet (lib/shopify.ts has the mutation; nothing
// calls it), and a button labelled "ใช้ส่วนลดนี้" that silently does not
// would be found out at the one moment it matters, on the payment page, by
// the customer. So it does the thing it can do honestly and leaves the code
// on screen as text, because a clipboard write can fail — no permission, an
// insecure context, an older browser — and then the only way to get the code
// is to read it.

export default function CopyCode({ code, className }: { code: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2400);
  }

  return (
    <button
      onClick={() => void copy()}
      // The label carries the code so a screen reader announces what was
      // copied, not just that something was.
      aria-label={state === "copied" ? `คัดลอกโค้ด ${code} แล้ว` : `คัดลอกโค้ด ${code}`}
      className={`flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold ${className ?? ""}`}
      style={{ backgroundColor: "var(--cp-accent)", color: "var(--cp-on-accent)" }}
    >
      {state === "copied" ? <Check size={14} /> : <Copy size={14} />}
      {state === "copied" ? "คัดลอกแล้ว" : state === "failed" ? "คัดลอกไม่ได้ — จดโค้ดไว้" : "เก็บโค้ด"}
    </button>
  );
}
