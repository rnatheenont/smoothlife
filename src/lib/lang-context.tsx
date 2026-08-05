"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { DICT } from "./dict";

export type Lang = "th" | "en";

type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (th: string, en?: string) => string;
  translating: boolean;
};

const LangContext = createContext<LangContextValue | null>(null);
const LANG_KEY = "sl_lang";
const CACHE_KEY = "sl_tr_cache";
const THAI = /[฀-๿]/;

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");
  const [translating, setTranslating] = useState(false);
  const [, force] = useState(0);

  // original text keyed by node, so switching back to Thai is lossless
  const origText = useRef<WeakMap<Text, string>>(new WeakMap());
  const origAttr = useRef<WeakMap<Element, Record<string, string>>>(new WeakMap());
  const cache = useRef<Record<string, string>>({});
  const pending = useRef<Set<string>>(new Set());
  const applying = useRef(false);
  const observer = useRef<MutationObserver | null>(null);
  const langRef = useRef<Lang>("th");
  const applyRef = useRef<((l: Lang) => void) | null>(null);

  const lookup = useCallback((s: string) => DICT[s] || cache.current[s] || null, []);

  const flushQueue = useCallback(async () => {
    const texts = [...pending.current].slice(0, 60);
    if (texts.length === 0) return;
    texts.forEach((t) => pending.current.delete(t));
    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.map) {
          Object.assign(cache.current, data.map);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache.current));
          } catch {}
          force((n) => n + 1);
          applyRef.current?.(langRef.current);
        }
      }
    } catch {
      // offline or no API key configured — Thai stays as-is
    } finally {
      setTranslating(false);
      if (pending.current.size > 0) flushQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = useCallback(
    (target: Lang) => {
      if (typeof document === "undefined") return;
      applying.current = true;
      observer.current?.disconnect();

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const queue: string[] = [];
      let node = walker.nextNode() as Text | null;
      while (node) {
        const parent = node.parentElement;
        const tag = parent?.tagName;
        if (tag !== "SCRIPT" && tag !== "STYLE" && tag !== "NOSCRIPT") {
          const stored = origText.current.get(node);
          const original = stored !== undefined ? stored : node.nodeValue || "";
          const trimmed = original.trim();
          if (trimmed && THAI.test(trimmed)) {
            if (stored === undefined) origText.current.set(node, original);
            if (target === "th") {
              if (node.nodeValue !== original) node.nodeValue = original;
            } else {
              const hit = lookup(trimmed);
              if (hit) {
                const replaced = original.replace(trimmed, hit);
                if (node.nodeValue !== replaced) node.nodeValue = replaced;
              } else {
                queue.push(trimmed);
              }
            }
          }
        }
        node = walker.nextNode() as Text | null;
      }

      // placeholders, titles and aria-labels
      const els = document.body.querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]");
      els.forEach((el) => {
        const attrs = ["placeholder", "title", "aria-label"];
        let store = origAttr.current.get(el);
        attrs.forEach((a) => {
          const current = el.getAttribute(a);
          if (current === null) return;
          const original = store && store[a] !== undefined ? store[a] : current;
          if (!THAI.test(original)) return;
          if (!store) {
            store = {};
            origAttr.current.set(el, store);
          }
          if (store[a] === undefined) store[a] = original;
          if (target === "th") {
            if (current !== original) el.setAttribute(a, original);
          } else {
            const hit = lookup(original.trim());
            if (hit) {
              if (current !== hit) el.setAttribute(a, hit);
            } else {
              queue.push(original.trim());
            }
          }
        });
      });

      document.documentElement.lang = target === "en" ? "en" : "th";
      applying.current = false;
      observer.current?.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      if (target === "en" && queue.length) {
        queue.forEach((q) => pending.current.add(q));
        flushQueue();
      }
    },
    [lookup, flushQueue]
  );

  applyRef.current = apply;

  // hydrate saved language + cache
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY) as Lang | null;
      const savedCache = localStorage.getItem(CACHE_KEY);
      if (savedCache) cache.current = JSON.parse(savedCache);
      if (saved === "en" || saved === "th") {
        langRef.current = saved;
        setLangState(saved);
      }
    } catch {}
  }, []);

  // observe DOM so React re-renders get re-translated
  useEffect(() => {
    let raf = 0;
    const obs = new MutationObserver(() => {
      if (applying.current) return;
      if (langRef.current === "th") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => apply(langRef.current));
    });
    observer.current = obs;
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [apply]);

  useEffect(() => {
    langRef.current = lang;
    apply(lang);
  }, [lang, apply]);

  const setLang = useCallback((l: Lang) => {
    langRef.current = l;
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  }, []);

  const toggle = useCallback(() => setLang(langRef.current === "th" ? "en" : "th"), [setLang]);

  const t = useCallback(
    (th: string, en?: string) => {
      if (lang === "th") return th;
      return en || DICT[th] || cache.current[th] || th;
    },
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, toggle, t, translating }}>{children}</LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) {
    return {
      lang: "th" as Lang,
      setLang: () => {},
      toggle: () => {},
      t: (th: string) => th,
      translating: false,
    };
  }
  return ctx;
}
