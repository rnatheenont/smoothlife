"use client";

import { Globe, Loader2 } from "lucide-react";
import { useLang } from "@/lib/lang-context";

const LANGS = ["th", "en"] as const;

export default function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, translating } = useLang();
  const activeIndex = LANGS.indexOf(lang);

  return (
    <div
      className={`relative inline-flex items-center gap-1 rounded-full bg-surface-soft border border-slate-200 shadow-sm p-1 ${
        compact ? "text-xs" : "text-sm"
      }`}
      role="group"
      aria-label="Language"
    >
      <span className={`grid place-items-center text-brand-emerald ${compact ? "h-6 w-6" : "h-7 w-7"}`}>
        {translating ? <Loader2 size={compact ? 13 : 15} className="animate-spin" /> : <Globe size={compact ? 13 : 15} />}
      </span>
      <span
        className={`absolute top-1 rounded-full bg-brand-gradient shadow-card transition-transform duration-300 ease-out ${
          compact ? "h-7 w-9" : "h-8 w-10"
        }`}
        style={{
          left: compact ? "1.75rem" : "2rem",
          transform: `translateX(${activeIndex * (compact ? 2.375 : 2.625)}rem)`,
        }}
        aria-hidden="true"
      />
      {LANGS.map((l) => (
        <button
          key={l}
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
