"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";

export type CommandItem = { href: string; label: string; group: string; icon: ComponentType<{ size?: number; className?: string }> };

/**
 * ⌘K / Ctrl+K: type a couple of letters, hit Enter, land on the page. The
 * console has fourteen screens and the people using it are on it all day —
 * reaching for the mouse to read a menu is the slow path.
 */
export default function CommandPalette({ items, openOnMount = false }: { items: CommandItem[]; openOnMount?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(openOnMount);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      inputRef.current?.focus();
    }
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => `${i.label} ${i.group}`.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center bg-black/30 p-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-surface-line"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="ค้นหาเมนูหลังบ้าน"
      >
        <div className="flex items-center gap-2 border-b border-surface-line px-4">
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, matches.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              }
              if (e.key === "Enter" && matches[cursor]) go(matches[cursor].href);
            }}
            placeholder="ไปที่หน้า… (พิมพ์ชื่อเมนู)"
            aria-label="ค้นหาเมนูหลังบ้าน"
            className="min-h-12 w-full bg-transparent text-sm text-brand-ink outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-surface-line px-1.5 py-0.5 text-[10px] text-slate-400 sm:block">esc</kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto p-2">
          {matches.map((item, i) => {
            const Icon = item.icon;
            return (
              <li key={item.href + item.label}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(item.href)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm ${
                    i === cursor ? "bg-brand-gradient-soft text-brand-800" : "text-slate-600"
                  }`}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="flex-1 font-semibold">{item.label}</span>
                  <span className="text-[11px] text-slate-400">{item.group}</span>
                  {i === cursor && <CornerDownLeft size={13} className="text-slate-400" aria-hidden />}
                </button>
              </li>
            );
          })}
          {matches.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">ไม่พบเมนูที่ค้นหา</li>}
        </ul>
      </div>
    </div>
  );
}
