"use client";

import { Globe, Loader2 } from "lucide-react";
import { useLang } from "@/lib/lang-context";

export default function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, translating } = useLang();

  return (
    <div
      className={`flex items-center rounded-full border border-slate-200 bg-white p-0.5 ${
        compact ? "text-[11px]" : "text-xs"
      }`}
      role="group"
      aria-label="Language"
    >
      <span className="pl-2 pr-1 text-slate-400">
        {translating ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
      </span>
      {(["th", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-2.5 py-1 font-bold uppercase transition-colors ${
            lang === l ? "bg-brand-gradient text-white" : "text-slate-500 hover:text-brand-emerald"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
