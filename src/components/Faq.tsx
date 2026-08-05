"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-slate-100 overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-3 p-4 text-left"
          >
            <span className="text-sm font-semibold text-brand-ink">{item.q}</span>
            <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open === i ? "rotate-180" : ""}`} />
          </button>
          {open === i && <div className="px-4 pb-4 text-sm text-slate-600">{item.a}</div>}
        </div>
      ))}
    </div>
  );
}
