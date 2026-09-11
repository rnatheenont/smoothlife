"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Globe, Loader2 } from "lucide-react";
import { useLang, type Lang } from "@/lib/lang-context";

// Each language named in itself. Someone looking for English on a Thai page
// is scanning for "English", not for "อังกฤษ" — and the reverse for a Thai
// reader who landed on the English version.
const LANGS: { code: Lang; native: string; hint: string }[] = [
  { code: "th", native: "ไทย", hint: "Thai" },
  { code: "en", native: "English", hint: "อังกฤษ" },
];

/**
 * The language picker, as a menu rather than a two-button pill.
 *
 * `variant="icon"` is the mobile header's form: an outline circle matching the
 * cart and bell beside it, since a coloured pill read as too heavy there.
 * Both open the same menu, so the choice looks and behaves the same on every
 * screen — and a third language is one more row rather than a redesign.
 */
export default function LanguageSwitch({
  compact = false,
  variant = "pill",
  align = "right",
}: {
  compact?: boolean;
  variant?: "pill" | "icon";
  align?: "left" | "right";
}) {
  const { lang, setLang, translating } = useLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  // Closes on a click anywhere else and on Escape — a menu that only closes
  // by picking something traps whoever opened it by accident.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(code: Lang) {
    setOpen(false);
    if (code !== lang) setLang(code);
  }

  return (
    // translate="no": the page translator must not touch this menu. Its whole
    // point is naming each language in itself, and a translated menu shows an
    // English reader two options called "Thai" and "English" in English — and
    // a Thai reader the reverse — which is exactly the case it exists to avoid.
    <div ref={rootRef} className="relative inline-block" translate="no">
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={translating}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={`ภาษา: ${current.native}`}
          className={clsx(
            "grid h-10 w-10 place-items-center rounded-full border text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-60",
            open ? "border-brand-teal text-brand-800" : "border-slate-200 text-slate-500"
          )}
        >
          {translating ? <Loader2 size={16} className="animate-spin" /> : current.code}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={translating}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          className={clsx(
            "flex items-center gap-1.5 rounded-full border bg-surface-soft shadow-sm transition hover:border-brand-teal hover:shadow-card disabled:opacity-70",
            compact ? "h-9 pl-2.5 pr-2 text-xs" : "h-10 pl-3 pr-2.5 text-sm",
            open ? "border-brand-teal shadow-card" : "border-slate-200"
          )}
        >
          <span className="text-brand-800">
            {translating ? <Loader2 size={compact ? 14 : 15} className="animate-spin" /> : <Globe size={compact ? 14 : 15} />}
          </span>
          <span className="font-bold text-brand-ink">{current.native}</span>
          <ChevronDown
            size={14}
            className={clsx("text-slate-400 transition-transform duration-200", open && "rotate-180")}
          />
        </button>
      )}

      <div
        id={menuId}
        role="menu"
        aria-label="เลือกภาษา / Language"
        className={clsx(
          "absolute z-50 mt-2 w-48 origin-top rounded-xl2 border border-slate-100 bg-white p-1.5 shadow-cardHover transition duration-150",
          align === "right" ? "right-0" : "left-0",
          open ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0"
        )}
      >
        <p className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-slate-600">
          ภาษา · Language
        </p>
        {LANGS.map((l) => {
          const active = l.code === lang;
          return (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              // Read as one name. Without it a screen reader ran the code
              // bubble and both names together: "thไทยThai".
              aria-label={`${l.native} (${l.hint})`}
              tabIndex={open ? 0 : -1}
              onClick={() => choose(l.code)}
              className={clsx(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                active ? "bg-brand-gradient-soft" : "hover:bg-slate-50"
              )}
            >
              <span
                aria-hidden="true"
                className={clsx(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold uppercase",
                  active ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-600"
                )}
              >
                {l.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className={clsx("block text-sm", active ? "font-bold text-brand-ink" : "font-medium text-slate-700")}>
                  {l.native}
                </span>
                <span className="block text-[11px] text-slate-600">{l.hint}</span>
              </span>
              {active && <Check size={15} className="shrink-0 text-brand-emerald" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
