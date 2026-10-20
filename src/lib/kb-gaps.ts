import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";

// Questions the shop has no answer for.
//
// Five places can notice one — the assistant searching and finding nothing,
// a customer asking for a person, a thumbs-down, a search on /faq that
// returns nothing, a question asked on a product page — and before this they
// each either logged it their own way or not at all. One function, so the
// queue an admin reads is the whole picture rather than whichever corner was
// wired up last.
//
// Counted, not appended: "ส่งกี่วัน" asked two hundred times is one row with
// hits=200, because a queue of two hundred identical rows is a queue nobody
// opens. The example wordings are kept so the person writing the answer can
// see how it was actually asked.

export type GapSource = "chat" | "faq" | "product" | "line";

const MAX_EXAMPLES = 10;

/** Lowercased, zero-width stripped, whitespace collapsed — the grouping key. */
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[​-‍﻿­]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/**
 * Record that somebody asked this and did not get an answer.
 *
 * Never throws and never blocks: this is bookkeeping, and a customer's reply
 * does not wait for it. Callers use `void recordGap(...)`.
 */
export async function recordGap(entry: { question: string; source: GapSource }): Promise<void> {
  const question = normalizeQuestion(entry.question);
  // One word is not a question anybody can write an answer to, and the queue
  // fills with them from half-typed searches.
  if (question.length < 4) return;
  if (!supabaseConfigured()) return;

  try {
    const existing = await supabaseRest<{ id: string; hits: number; examples: string[] | null; sources: string[] | null }[]>(
      `kb_gaps?question=eq.${pgValue(question)}&select=id,hits,examples,sources&limit=1`
    );
    const hit = existing?.[0];

    if (hit) {
      await supabaseRest(`kb_gaps?id=eq.${hit.id}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({
          hits: (hit.hits ?? 0) + 1,
          examples: [...new Set([...(hit.examples ?? []), entry.question.trim()])].slice(-MAX_EXAMPLES),
          sources: [...new Set([...(hit.sources ?? []), entry.source])],
          last_seen: new Date().toISOString(),
        }),
      });
      return;
    }

    await supabaseRest("kb_gaps", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        question,
        examples: [entry.question.trim()],
        hits: 1,
        sources: [entry.source],
        status: "open",
      }),
    });
  } catch (err) {
    // Deliberately swallowed. A failure to write the queue must not become a
    // failure to answer the customer.
    console.error("[kb] recording a gap failed", err);
  }
}
