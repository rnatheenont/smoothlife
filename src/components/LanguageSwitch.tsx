"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { useLang } from "@/lib/lang-context";

const LANGS = ["th", "en"] as const;

export default function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, translating } = useLang();
  const groupRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<(typeof LANGS)[number], HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  // Measures the actual selected button's position instead of hardcoding
  // left/translateX magic numbers — those previously assumed a fixed globe
  // icon width + gap + padding that drifted out of sync with the real
  // rendered geometry, leaving the highlight pill a few px off from the
  // button it's supposed to sit under.
  useLayoutEffect(() => {
    const group = groupRef.current;
    const btn = btnRefs.current[lang];
    if (!group || !btn) return;
    const groupRect = group.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setPill({ left: btnRect.left - groupRect.left, width: btnRect.width });
  }, [lang, compact]);

  return (
    <div
      ref={groupRef}
      className={`relative inline-flex items-center gap-1 rounded-full bg-surface-soft border border-slate-200 shadow-xs p-1 ${
        compact ? "text-xs" : "text-sm"
      }`}
      role="group"
      aria-label="Language"
    >
      <span className={`grid place-items-center text-brand-emerald ${compact ? "h-6 w-6" : "h-7 w-7"}`}>
        {translating ? <Loader2 size={compact ? 13 : 15} className="animate-spin" /> : <Globe size={compact ? 13 : 15} />}
      </span>
      {pill && (
        <span
          className={`absolute top-1 rounded-full bg-brand-gradient shadow-card transition-[left,width] duration-300 ease-out ${
            compact ? "h-7" : "h-8"
          }`}
          style={{ left: pill.left, width: pill.width }}
          aria-hidden="true"
        />
      )}
      {LANGS.map((l) => (
        <button
          key={l}
          ref={(el) => {
            btnRefs.current[l] = el;
          }}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`relative z-10 grid place-items-center rounded-full font-bold uppercase transition-all active:scale-90 ${
            compact ? "h-7 w-9" : "h-8 w-10"
          } ${lang === l ? "text-white" : "text-slate-500 hover:text-brand-emerald"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
