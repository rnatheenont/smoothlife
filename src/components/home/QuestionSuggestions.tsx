"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircleQuestion, Search } from "lucide-react";

// What drops out of the AI field as a shopper types.
//
// Questions, not products. The field asks an assistant something; a list of
// packshots under it answered a different question from the one being typed,
// and left the shopper to work out the wording of their own. These are the
// lines the shop already knows how to answer — written by an admin, or taken
// from what customers have actually asked — so picking one is the shortest
// road to a good reply.
//
// The whole list is fetched once and filtered here. It is a few dozen short
// strings; asking the server on every keystroke would be a request per
// character to search something the page is already holding.

type Question = { id: string; text: string };

/** More than this under a field in the middle of the band and the list runs
 *  off the bottom of a laptop screen. */
const SHOWN = 5;

let cache: Question[] | null = null;

export default function QuestionSuggestions({
  query,
  onPick,
}: {
  query: string;
  onPick: (text: string) => void;
}) {
  const [all, setAll] = useState<Question[]>(cache ?? []);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetch("/api/chat-suggestions")
      .then((r) => r.json())
      .then((d: { questions?: Question[] }) => {
        cache = d.questions ?? [];
        if (alive) setAll(cache);
      })
      .catch(() => {
        // No list is the field as it was before this existed.
      });
    return () => {
      alive = false;
    };
  }, []);

  const q = query.trim().toLowerCase();

  const hits = useMemo(() => {
    if (!q) return [];
    // Questions that begin with what has been typed come first: someone two
    // characters in is far more often starting a word than recalling one
    // from the middle of a sentence.
    const starts: Question[] = [];
    const contains: Question[] = [];
    for (const item of all) {
      const text = item.text.toLowerCase();
      if (text.startsWith(q)) starts.push(item);
      else if (text.includes(q)) contains.push(item);
    }
    return [...starts, ...contains].slice(0, SHOWN);
  }, [all, q]);

  if (!q) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl bg-white text-left shadow-cardHover">
      {hits.length === 0 ? (
        // Still a way forward: what was typed is a perfectly good question,
        // and the assistant can take it as it stands.
        <button
          type="button"
          onClick={() => onPick(query.trim())}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-soft"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
            <Search size={15} />
          </span>
          <span className="min-w-0 flex-1 text-sm text-brand-ink">
            ถามน้อง Smoothie ว่า “{query.trim()}”
          </span>
        </button>
      ) : (
        <ul>
          {hits.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onPick(item.text)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-soft"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
                  <MessageCircleQuestion size={15} />
                </span>
                <span className="min-w-0 flex-1 text-sm text-brand-ink">{item.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
