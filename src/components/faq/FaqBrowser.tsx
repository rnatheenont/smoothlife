"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, X, MessageCircle } from "lucide-react";
import clsx from "clsx";
import type { FaqIndexItem, FaqTopic } from "@/lib/faq-public";
import { scoreFaq, matchRanges } from "@/lib/faq-score";

// Search and filtering over a list the server already rendered.
//
// The answers are not in this component. Every question and its full answer
// arrives as HTML from the server — collapsed inside <details>, but present —
// because an FAQ page that needs JavaScript to show its text is a page an AI
// crawler reads as empty. This component is handed those nodes as `children`
// and never re-renders them: it hides the ones that do not match by setting
// `hidden`, and reorders the rest with CSS `order`. Nothing about the answers
// round-trips through React state, so filtering costs no re-render and the
// text cannot be lost to a hydration mismatch.
//
// State lives in the URL (?q=, ?topic=, ?concern=) so a filtered view can be
// sent to somebody. It is read from window.location rather than through
// useSearchParams, which would opt the whole page out of static rendering —
// the first paint is the unfiltered list either way, which is exactly what a
// crawler should see.

/** When layer 1 finds too little, ask the server for a meaning-based match. */
const THIN_RESULT = 2;
const SEARCH_DEBOUNCE_MS = 400;
const LONG_QUERY = 12;

type Tab = "concern" | "product" | "ordering";
const ORDERING_TOPIC = "ordering-support";

const TABS: { key: Tab; label: string }[] = [
  { key: "concern", label: "ตามปัญหา" },
  { key: "product", label: "ตามสินค้า/แบรนด์" },
  { key: "ordering", label: "สั่งซื้อ & บริการ" },
];

export default function FaqBrowser({
  index,
  sections,
  concerns,
  popular,
  children,
}: {
  index: FaqIndexItem[];
  sections: FaqTopic[];
  concerns: FaqTopic[];
  popular: string[];
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("concern");
  const [topic, setTopic] = useState<string | null>(null);
  const [concern, setConcern] = useState<string | null>(null);
  /** Slugs the server's meaning-based search found, when layer 1 was thin. */
  const [semantic, setSemantic] = useState<string[] | null>(null);
  const [ready, setReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  /** The slug from /faq#its-slug, captured on mount before the URL is synced. */
  const deepLink = useRef("");
  /** Bumped on hashchange, to re-run the deep-link effect for a new hash. */
  const [hashTick, setHashTick] = useState(0);
  /** Whether a filter or the search box has been touched by the reader. */
  const touched = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Product tabs filter by section; "สั่งซื้อ & บริการ" is one section, so it
  // is a tab rather than a chip — nobody browses a help topic by picking it
  // twice.
  const productSections = useMemo(() => sections.filter((s) => s.slug !== ORDERING_TOPIC), [sections]);

  const readUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") ?? "";
    const t = params.get("topic");
    const c = params.get("concern");
    setQuery(q);
    setTopic(t);
    setConcern(c);
    if (t === ORDERING_TOPIC) setTab("ordering");
    else if (t) setTab("product");
    else if (c) setTab("concern");
    else setTab("concern");
  }, []);

  useEffect(() => {
    readUrl();
    // Read here, before anything rewrites the address bar. /faq#its-slug is a
    // link somebody was sent, and it has to survive the first replaceState.
    deepLink.current = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    setReady(true);
  }, [readUrl]);

  // Back and forward move the filters, because the filters are in the URL.
  // Without this the address bar and the list disagree after one Back.
  useEffect(() => {
    const onPop = () => {
      touched.current = false;
      readUrl();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [readUrl]);

  // Keep the address bar in step without pushing history entries: typing a
  // question should not need the back button pressed once per letter.
  useEffect(() => {
    // Only after the reader has actually changed something. Writing on mount
    // meant that arriving at a bare /faq while this component was still alive
    // — following the header's own link from /faq?topic=… — rewrote the clean
    // address back to the stale filter instead of clearing it.
    if (!ready || !touched.current) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (topic) params.set("topic", topic);
    if (concern) params.set("concern", concern);
    const search = params.toString();
    // The hash is kept. Dropping it broke the one link this page exists to
    // be shareable by: the sync ran before the deep-link effect, which then
    // read an empty hash and opened nothing.
    const hash = window.location.hash;
    window.history.replaceState(null, "", `/faq${search ? `?${search}` : ""}${hash}`);
  }, [ready, query, topic, concern]);

  const scored = useMemo(() => {
    const trimmed = query.trim();
    const byFilter = index.filter(
      (item) => (!topic || item.topic === topic) && (!concern || item.concerns.includes(concern))
    );
    if (!trimmed) return byFilter.map((item) => ({ item, score: 0 }));
    return scoreFaq(byFilter, trimmed);
  }, [index, query, topic, concern]);

  // Layer 2. Only when layer 1 came back thin, or the customer wrote a
  // sentence — a sentence shares few literal strings with a question written
  // by somebody else, which is the case substring matching cannot serve.
  useEffect(() => {
    const trimmed = query.trim();
    if (!ready || !trimmed) {
      setSemantic(null);
      return;
    }
    if (scored.length >= THIN_RESULT && trimmed.length < LONG_QUERY) {
      setSemantic(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/faq/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { slugs?: string[] } | null) => setSemantic(data?.slugs ?? []))
        .catch(() => {
          // An aborted or failed lookup leaves layer 1's answer standing.
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ready, query, scored.length]);

  /** Layer 1's hits, then anything only the server's search found. */
  const visible = useMemo(() => {
    const order = new Map<string, number>();
    scored.forEach(({ item }, i) => order.set(item.slug, i));
    if (semantic) {
      for (const slug of semantic) {
        if (order.has(slug)) continue;
        const item = index.find((x) => x.slug === slug);
        if (!item) continue;
        if (topic && item.topic !== topic) continue;
        if (concern && !item.concerns.includes(concern)) continue;
        order.set(slug, order.size);
      }
    }
    return order;
  }, [scored, semantic, index, topic, concern]);

  // The one place the DOM is touched by hand. Driven by `visible`, so it runs
  // once per change of filter rather than per keystroke per item.
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>("[data-faq-slug]");
    for (const node of nodes) {
      const slug = node.dataset.faqSlug ?? "";
      const rank = visible.get(slug);
      node.hidden = rank === undefined;
      node.style.order = rank === undefined ? "" : String(rank);
      if (rank !== undefined) markQuery(node, query);
    }
  }, [visible, query]);

  // One result means the question was found — show the answer rather than
  // making them tap the thing they just searched for.
  useEffect(() => {
    const root = listRef.current;
    if (!root || !query.trim()) return;
    const only = visible.size === 1 ? [...visible.keys()][0] : null;
    for (const node of root.querySelectorAll<HTMLDetailsElement>("details[data-faq-slug]")) {
      if (only && node.dataset.faqSlug === only) node.open = true;
    }
  }, [visible, query]);

  // A link straight to one question (/faq#its-slug) opens it and scrolls.
  //
  // Runs after the filtering effect has had its turn, so the node it opens is
  // not one that is about to be hidden, and reads the slug captured on mount
  // rather than the live hash.
  //
  // A hashchange counts too. Arriving from another page mounts this component
  // and the mount effect reads the hash, but a reader already on /faq who
  // follows a #slug link — from an answer, or with the back button — changes
  // only the hash: nothing remounts, and an effect with an empty dependency
  // list will never run again.
  useEffect(() => {
    const onHash = () => {
      deepLink.current = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      setHashTick((n) => n + 1);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const slug = deepLink.current;
    if (!slug) return;
    const node = listRef.current?.querySelector<HTMLDetailsElement>(`details[data-faq-slug="${CSS.escape(slug)}"]`);
    // The slug is kept until it has actually been used. Clearing it first
    // meant one early pass — before the node was in the list, or while it was
    // still hidden by a filter — spent the link and opened nothing.
    if (!node || node.hidden) return;
    deepLink.current = "";
    node.open = true;
    node.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [ready, visible, hashTick]);

  const clear = useCallback(() => {
    touched.current = true;
    setQuery("");
    setSemantic(null);
    inputRef.current?.focus();
  }, []);

  /**
   * How many questions each chip would show, counted against the search but
   * not against the chip already picked — so the numbers say what tapping
   * that chip would do, instead of collapsing to 0/1 the moment one is on.
   */
  const chipCounts = useMemo(() => {
    const base = index.filter((item) => {
      if (!query.trim()) return true;
      return scoreFaq([item], query).length > 0;
    });
    const counts = new Map<string, number>();
    for (const item of base) {
      if (item.topic) counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1);
      for (const c of item.concerns) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return counts;
  }, [index, query]);

  const chips = tab === "concern" ? concerns : tab === "product" ? productSections : [];
  const activeChip = tab === "concern" ? concern : topic;
  const filtering = Boolean(query.trim() || topic || concern);
  const askHref = `/chat?q=${encodeURIComponent(query.trim() || "ขอคำแนะนำเรื่องสินค้าหน่อย")}`;

  function pickTab(next: Tab) {
    touched.current = true;
    setTab(next);
    setConcern(null);
    setTopic(next === "ordering" ? ORDERING_TOPIC : null);
  }

  function pickChip(slug: string) {
    touched.current = true;
    if (tab === "concern") setConcern(concern === slug ? null : slug);
    else setTopic(topic === slug ? null : slug);
  }

  return (
    <div>
      {/* Three blocks, each one labelled. They used to be three rows of
          near-identical pills — a view switcher and a filter row that looked
          the same and said nothing about what they did. The labels are the
          fix: "search", "browse by", and the result count underneath. */}
      <div>
        <label htmlFor="faq-search" className="mb-1.5 block text-sm font-semibold text-brand-ink">
          ค้นหาคำตอบ
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            id="faq-search"
            type="search"
            value={query}
            onChange={(e) => {
              touched.current = true;
              setQuery(e.target.value);
            }}
            placeholder='พิมพ์คำถาม เช่น "หน้ามัน เป็นสิว"'
            className="h-12 w-full rounded-full bg-white pl-12 pr-11 text-base text-brand-ink outline-none ring-1 ring-surface-line placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand-800"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              aria-label="ล้างคำค้นหา"
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-surface-soft hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {popular.length > 0 && (
          /* Shortcuts into the field above, so they are written as searches —
             a magnifier and plain text — rather than as another row of pills
             a reader has to tell apart from the filters below. */
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-xs text-slate-500">คำที่คนค้นบ่อย</span>
            {popular.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  touched.current = true;
                  setQuery(term);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
              >
                <Search className="h-3 w-3" aria-hidden />
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sticky top-[var(--header-h,56px)] z-20 -mx-4 mt-6 bg-white/95 px-4 pb-2 pt-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:pt-0 md:backdrop-blur-none">
        <p className="mb-1.5 text-sm font-semibold text-brand-ink">เลือกดูตาม</p>

        {/* A segmented control, not more pills: one track, one thing lit.
            It reads as "which list am I looking at", which is what it is. */}
        <div
          role="tablist"
          aria-label="เลือกดูตาม"
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-mist p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => pickTab(key)}
              className={clsx(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800",
                tab === key ? "bg-white text-brand-1000 shadow-xs" : "text-slate-600 hover:text-brand-800"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {chips.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* "ทั้งหมด" first, so the unfiltered state is something you can
                see and click back to rather than an absence you have to infer
                from nothing being highlighted. */}
            <button
              type="button"
              aria-pressed={!activeChip}
              onClick={() => {
                touched.current = true;
                if (tab === "concern") setConcern(null);
                else setTopic(tab === "ordering" ? ORDERING_TOPIC : null);
              }}
              className={clsx(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800",
                !activeChip ? "bg-brand-800 text-white" : "bg-white text-slate-600 ring-1 ring-surface-line hover:text-brand-800 hover:ring-brand-800/50"
              )}
            >
              ทั้งหมด
            </button>
            {chips.map((c) => {
              const count = chipCounts.get(c.slug) ?? 0;
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={activeChip === c.slug}
                  disabled={count === 0}
                  onClick={() => pickChip(c.slug)}
                  className={clsx(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800",
                    count === 0
                      ? "cursor-not-allowed bg-white text-slate-300 ring-1 ring-surface-line"
                      : activeChip === c.slug
                        ? "bg-brand-800 text-white"
                        : "bg-white text-slate-600 ring-1 ring-surface-line hover:text-brand-800 hover:ring-brand-800/50"
                  )}
                >
                  {c.label_th}
                  {/* The number is why a chip is worth tapping, and why an
                      empty one is worth not tapping. */}
                  <span className={clsx("ml-1.5 tabular-nums", activeChip === c.slug ? "text-white/70" : "text-slate-400")}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* aria-live so a screen reader hears the count change, since the list
          itself is updated outside React's control. */}
      <p className="mt-4 text-sm text-slate-500" aria-live="polite">
        {!ready ? `ทั้งหมด ${index.length} ข้อ` : filtering ? `พบ ${visible.size} ข้อ` : `ทั้งหมด ${index.length} ข้อ`}
      </p>

      <div ref={listRef} className="mt-3 flex flex-col gap-3">
        {children}
      </div>

      {ready && filtering && visible.size === 0 && (
        <div className="mt-4 rounded-xl2 bg-white p-6 text-center ring-1 ring-surface-line">
          <p className="text-base font-semibold text-brand-ink">
            {query.trim() ? `ยังไม่มีคำตอบสำหรับ "${query.trim()}"` : "ยังไม่มีคำถามในหมวดนี้"}
          </p>
          <p className="mt-1 text-sm text-slate-500">ถามน้อง Smoothie ได้เลย ทีมงานจะเห็นคำถามนี้และเขียนคำตอบเพิ่มให้</p>
          <a
            href={askHref}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            ถามน้อง Smoothie
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Wrap the parts of a question that match the query in <mark>.
 *
 * Built from DOM nodes rather than innerHTML. The question comes from a
 * database column, and the moment this function takes a string of HTML it
 * becomes the place a stored script tag would run — building text nodes makes
 * that impossible rather than merely unlikely.
 *
 * The untouched question is kept in a data attribute so each pass starts from
 * the original instead of marking up its own previous output.
 */
function markQuery(node: HTMLElement, query: string) {
  const target = node.querySelector<HTMLElement>("[data-faq-title]");
  if (!target) return;
  // Two attributes, not one. `data-faq-title` says "this is the text you may
  // mark up"; `data-faq-raw` holds the text as the server wrote it. Using the
  // marker as the store put the question's text through React's boolean
  // attribute rendering — `data-faq-title` became the string "true", so the
  // first pass read "true" as the original and wrote it over every question.
  const original = target.dataset.faqRaw ?? target.textContent ?? "";
  if (target.dataset.faqRaw === undefined) target.dataset.faqRaw = original;

  const trimmed = query.trim();
  const ranges = trimmed ? matchRanges(original, trimmed) : [];
  if (ranges.length === 0) {
    if (target.childNodes.length !== 1 || target.firstChild?.nodeType !== Node.TEXT_NODE) {
      target.replaceChildren(document.createTextNode(original));
    } else if (target.textContent !== original) {
      target.textContent = original;
    }
    return;
  }

  const parts: Node[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(document.createTextNode(original.slice(at, start)));
    const mark = document.createElement("mark");
    mark.className = "rounded bg-brand-100 px-0.5 text-brand-1000";
    mark.textContent = original.slice(start, end);
    parts.push(mark);
    at = end;
  }
  if (at < original.length) parts.push(document.createTextNode(original.slice(at)));
  target.replaceChildren(...parts);
}
